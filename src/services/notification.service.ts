import { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { Application } from '../models/application.model';
import { UserModel, UserRole } from '../models/user.model';
import { VoteModel, VoteType } from '../models/vote.model';

/**
 * Сервис для работы с уведомлениями и их рассылки пользователям
 */
export class NotificationService {
  private bot: Bot;

  /**
   * Конструктор сервиса уведомлений
   * @param bot - Экземпляр бота Telegram
   */
  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Отправляет простое текстовое сообщение пользователю
   * @param telegramId - ID получателя в Telegram
   * @param message - Текст сообщения
   * @param keyboard - Опциональная клавиатура
   * @returns true, если сообщение успешно отправлено
   */
  async sendMessage(telegramId: number | string, message: string, keyboard?: InlineKeyboard): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(
        String(telegramId),
        message,
        keyboard ? { reply_markup: keyboard } : undefined
      );
      return true;
    } catch (error) {
      console.error(`Ошибка при отправке сообщения пользователю ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Отправка уведомления о новой заявке всем пользователям с правом голоса
   * @param application - Новая заявка
   */
  async notifyAboutNewApplication(application: Application): Promise<void> {
    try {
      // Получение всех пользователей с правом голоса
      const voters = await UserModel.getVoters();
      
      if (voters.length === 0) {
        console.log('Нет пользователей с правом голоса для уведомления о новой заявке');
        return;
      }
      
      // Преобразуем все числовые идентификаторы в строки, чтобы избежать проблем с BigInt
      const applicationWithStringId = {
        ...application,
        id: String(application.id)
      };
      
      // Формирование сообщения с информацией о заявке
      const message = this.formatApplicationMessage(applicationWithStringId);
      
      // Создание клавиатуры с кнопками для голосования
      const applicationIdStr = String(application.id);
      const keyboard = new InlineKeyboard()
        .text("👍 За", `vote_yes_${applicationIdStr}`)
        .text("👎 Против", `vote_no_${applicationIdStr}`)
        .row()
        .text("❓ Задать вопрос", `ask_${applicationIdStr}`);
      
      // Подсчет времени до завершения голосования
      const votingTimeLeft = this.getVotingTimeLeftDescription(application.votingEndsAt);
      
      // Отправка уведомления каждому пользователю с правом голоса
      for (const voter of voters) {
        try {
          // Проверяем, не является ли голосующий автором заявки
          if (voter.telegramId === application.telegramId) {
            console.log(`Пропуск отправки уведомления автору заявки: ${voter.telegramId}`);
            continue;
          }
          
          await this.bot.api.sendMessage(
            String(voter.telegramId),
            `📨 *Новая заявка на вступление!*\n\n${message}\n\n⏳ Голосование завершится: ${votingTimeLeft}`,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
          
          console.log(`Отправлено уведомление о новой заявке пользователю: ${voter.telegramId}`);
        } catch (error) {
          console.error(`Не удалось отправить уведомление пользователю ${voter.telegramId}:`, error);
        }
      }
      
      console.log(`Уведомления о новой заявке отправлены ${voters.length} пользователям`);
    } catch (error) {
      console.error('Ошибка при отправке уведомлений о новой заявке:', error);
    }
  }

  /**
   * Обработка голоса пользователя за заявку
   * @param telegramId - Telegram ID голосующего
   * @param applicationId - ID заявки
   * @param isPositive - Тип голоса (положительный/отрицательный)
   */
  async processVote(telegramId: number, applicationId: number, isPositive: boolean): Promise<boolean> {
    try {
      // Проверка прав на голосование
      const user = await UserModel.getByTelegramId(telegramId);
      
      if (!user || !user.id) {
        console.error(`Пользователь ${telegramId} не найден`);
        return false;
      }
      
      if (!user.canVote) {
        console.error(`Пользователь ${telegramId} не имеет права голоса`);
        return false;
      }
      
      // Проверка существования заявки
      const application = await this.getApplicationById(applicationId);
      
      if (!application) {
        console.error(`Заявка с ID ${applicationId} не найдена`);
        return false;
      }
      
      // Проверка, что пользователь не голосует за свою заявку
      if (user.telegramId === application.telegramId) {
        console.error(`Пользователь ${telegramId} пытается голосовать за свою заявку`);
        return false;
      }
      
      // Проверка, что пользователь ещё не голосовал за эту заявку
      const hasVoted = await VoteModel.hasUserVoted(user.id, applicationId);
      
      if (hasVoted) {
        console.error(`Пользователь ${telegramId} уже голосовал за заявку ${applicationId}`);
        return false;
      }
      
      // Добавление голоса
      const voteType = isPositive ? VoteType.POSITIVE : VoteType.NEGATIVE;
      
      // Преобразуем все ID в строки, чтобы избежать проблем с BigInt
      const applicationIdStr = String(applicationId);
      
      await VoteModel.create({
        applicationId: applicationIdStr,
        userId: user.id,
        voteType
      });
      
      // Обновление счетчика голосов в заявке
      await this.updateApplicationVoteCount(applicationId);
      
      // Уведомление автора заявки о новом голосе
      await this.notifyApplicantAboutVote(application, isPositive);
      
      return true;
    } catch (error) {
      console.error('Ошибка при обработке голоса:', error);
      return false;
    }
  }

  /**
   * Отправка вопроса к заявке
   * @param fromTelegramId - Telegram ID спрашивающего
   * @param applicationId - ID заявки
   * @param question - Текст вопроса
   */
  async sendQuestionToApplicant(fromTelegramId: number, applicationId: number, question: string): Promise<boolean> {
    try {
      // Проверка прав на отправку вопросов
      const fromUser = await UserModel.getByTelegramId(fromTelegramId);
      
      if (!fromUser || !fromUser.id) {
        console.error(`Пользователь ${fromTelegramId} не найден`);
        return false;
      }
      
      if (!fromUser.canVote && fromUser.role !== UserRole.ADMIN) {
        console.error(`Пользователь ${fromTelegramId} не имеет права задавать вопросы`);
        return false;
      }
      
      // Проверка существования заявки
      const application = await this.getApplicationById(applicationId);
      
      if (!application) {
        console.error(`Заявка с ID ${applicationId} не найдена`);
        return false;
      }
      
      // Проверка, что пользователь не задает вопрос к своей заявке
      if (fromUser.telegramId === application.telegramId) {
        console.error(`Пользователь ${fromTelegramId} пытается задать вопрос к своей заявке`);
        return false;
      }
      
      // Добавление вопроса в базу данных
      // TODO: Реализовать модель для вопросов
      
      // Преобразуем ID в строки
      const applicationIdStr = String(applicationId);
      const fromUserIdStr = String(fromUser.id);
      
      // Отправка уведомления заявителю
      const keyboard = new InlineKeyboard()
        .text("Ответить", `answer_${applicationIdStr}_${fromUserIdStr}`);
      
      await this.bot.api.sendMessage(
        String(application.telegramId),
        `❓ *Вопрос к вашей заявке*\n\n` +
        `От: ${fromUser.firstName} ${fromUser.lastName || ''}\n` +
        `Вопрос: ${question}\n\n` +
        `Нажмите кнопку "Ответить", чтобы ответить на этот вопрос.`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
      // Отправка подтверждения спрашивающему
      await this.bot.api.sendMessage(
        String(fromTelegramId),
        `✅ Ваш вопрос к заявке #${applicationIdStr} успешно отправлен.`,
        { parse_mode: 'Markdown' }
      );
      
      return true;
    } catch (error) {
      console.error('Ошибка при отправке вопроса:', error);
      return false;
    }
  }

  /**
   * Отправка уведомления о завершении голосования заявителю
   * @param application - Заявка, по которой завершено голосование
   * @param approved - Результат голосования (одобрено/отклонено)
   */
  async notifyApplicantAboutVotingResult(application: Application, approved: boolean): Promise<void> {
    try {
      const { telegramId, minecraftUsername, votesPositive, votesNegative } = application;
      console.log(`Начало отправки уведомления о результате голосования пользователю ${telegramId}, approved=${approved}`);
      
      let message: string;
      if (approved) {
        message = 
          `🎉 *Поздравляем!* Ваша заявка на вступление одобрена!\n\n` +
          `Ник в Minecraft: \`${minecraftUsername}\`\n` +
          `Результаты голосования: 👍 ${votesPositive} / 👎 ${votesNegative}\n\n` +
          `Вы добавлены в белый список сервера и можете присоединиться к игре.`;
          console.log(`Сформировано сообщение об одобрении для пользователя ${telegramId}`);
      } else {
        message = 
          `😔 К сожалению, ваша заявка на вступление отклонена.\n\n` +
          `Ник в Minecraft: \`${minecraftUsername}\`\n` +
          `Результаты голосования: 👍 ${votesPositive} / 👎 ${votesNegative}\n\n` +
          `Вы можете подать новую заявку через некоторое время.`;
          console.log(`Сформировано сообщение об отклонении для пользователя ${telegramId}`);
      }
      
      const keyboard = new InlineKeyboard()
        .text("Проверить профиль", "profile")
        .row()
        .text("На главную", "start");
      
      console.log(`Попытка отправки сообщения пользователю ${telegramId}`);
      await this.bot.api.sendMessage(
        String(telegramId),
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
      console.log(`Успешно отправлено уведомление о результате голосования пользователю ${telegramId}`);
    } catch (error) {
      console.error(`Ошибка при отправке уведомления о результате голосования: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Отправка уведомления о недостаточном количестве голосов заявителю
   * @param application - Заявка с недостаточным количеством голосов
   */
  async notifyApplicantAboutInsufficientVotes(application: Application): Promise<void> {
    try {
      const { telegramId, minecraftUsername, votesPositive, votesNegative } = application;
      
      const message = 
        `⚠️ *Уведомление о вашей заявке*\n\n` +
        `Время голосования по вашей заявке закончилось, но не набрано достаточное количество голосов.\n\n` +
        `Ник в Minecraft: \`${minecraftUsername}\`\n` +
        `Результаты голосования: 👍 ${votesPositive} / 👎 ${votesNegative}\n\n` +
        `Вы можете подать новую заявку.`;
      
      const keyboard = new InlineKeyboard()
        .text("Подать новую заявку", "apply")
        .row()
        .text("На главную", "start");
      
      await this.bot.api.sendMessage(
        String(telegramId),
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
      console.log(`Отправлено уведомление о недостаточном количестве голосов пользователю ${telegramId}`);
    } catch (error) {
      console.error('Ошибка при отправке уведомления о недостаточном количестве голосов:', error);
    }
  }

  /**
   * Отправка напоминания о незавершенном голосовании пользователям с правом голоса
   * @param application - Заявка, по которой скоро завершится голосование
   * @param hoursLeft - Количество часов до завершения голосования
   */
  async sendVotingReminder(application: Application, hoursLeft: number): Promise<void> {
    try {
      // Получение всех пользователей с правом голоса
      const voters = await UserModel.getVoters();
      
      if (voters.length === 0) {
        console.log('Нет пользователей с правом голоса для отправки напоминания');
        return;
      }
      
      // Преобразуем все числовые идентификаторы в строки, чтобы избежать проблем с BigInt
      const applicationWithStringId = {
        ...application,
        id: String(application.id)
      };
      
      // Формирование сообщения с информацией о заявке
      const message = this.formatApplicationMessage(applicationWithStringId);
      
      // Создание клавиатуры с кнопками для голосования
      const applicationIdStr = String(application.id);
      const keyboard = new InlineKeyboard()
        .text("👍 За", `vote_yes_${applicationIdStr}`)
        .text("👎 Против", `vote_no_${applicationIdStr}`)
        .row()
        .text("❓ Задать вопрос", `ask_${applicationIdStr}`);
      
      // Подсчет времени до завершения голосования
      const votingTimeLeft = this.getVotingTimeLeftDescription(application.votingEndsAt);
      
      // Отправка напоминания каждому пользователю с правом голоса, который еще не голосовал
      for (const voter of voters) {
        try {
          // Проверяем, не является ли голосующий автором заявки
          if (voter.telegramId === application.telegramId) {
            continue;
          }
          
          // Проверяем, голосовал ли уже пользователь за эту заявку
          if (voter.id) {
            const hasVoted = await VoteModel.hasUserVoted(voter.id, applicationIdStr);
            if (hasVoted) {
              continue;
            }
          }
          
          await this.bot.api.sendMessage(
            String(voter.telegramId),
            `⏳ *Напоминание о голосовании*\n\n` +
            `Осталось ${hoursLeft} ч. до завершения голосования по заявке:\n\n` +
            `${message}\n\n` +
            `⏳ Голосование завершится: ${votingTimeLeft}`,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
          
          console.log(`Отправлено напоминание о голосовании пользователю: ${voter.telegramId}`);
        } catch (error) {
          console.error(`Не удалось отправить напоминание пользователю ${voter.telegramId}:`, error);
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке напоминаний о голосовании:', error);
    }
  }

  /**
   * Вспомогательный метод для форматирования сообщения с информацией о заявке
   * @param application - Заявка
   * @returns Отформатированный текст с информацией о заявке
   */
  private formatApplicationMessage(application: Application): string {
    const { id, minecraftUsername, reason, votesPositive, votesNegative, created } = application;
    
    return (
      `📝 *Заявка #${String(id)}*\n` +
      `🎮 *Ник в Minecraft*: \`${minecraftUsername}\`\n` +
      `📅 *Дата подачи*: ${new Date(created).toLocaleString()}\n` +
      `📊 *Статус голосования*: 👍 ${votesPositive} / 👎 ${votesNegative}\n\n` +
      `💬 *Причина*: ${reason}`
    );
  }

  /**
   * Вспомогательный метод для форматирования оставшегося времени голосования
   * @param votingEndsAt - Дата и время окончания голосования
   * @returns Отформатированное описание оставшегося времени
   */
  private getVotingTimeLeftDescription(votingEndsAt: Date): string {
    const now = new Date();
    const endsAt = new Date(votingEndsAt);
    
    if (now >= endsAt) {
      return 'Голосование завершено';
    }
    
    const diffMs = endsAt.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours} ч. ${diffMinutes} мин.`;
    } else {
      return `${diffMinutes} мин.`;
    }
  }

  /**
   * Получает заявку по ID
   * @param id ID заявки
   * @returns Заявка или null, если не найдена
   */
  private async getApplicationById(id: number | string): Promise<Application | null> {
    try {
      // Преобразуем ID в строку, чтобы избежать проблем с BigInt
      const idStr = String(id);
      
      // Импортируем модель динамически для избежания циклических зависимостей
      const { ApplicationModel } = await import('../models/application.model');
      return await ApplicationModel.getById(idStr);
    } catch (error) {
      console.error('Error getting application by ID:', error);
      return null;
    }
  }

  /**
   * Вспомогательный метод для обновления счетчика голосов в заявке
   * @param applicationId - ID заявки
   * @returns true, если обновление успешно
   */
  private async updateApplicationVoteCount(applicationId: number): Promise<boolean> {
    try {
      // Преобразуем ID в строку, чтобы избежать проблем с BigInt
      const applicationIdStr = String(applicationId);
      
      // Получение текущего количества положительных и отрицательных голосов
      const votes = await VoteModel.countVotes(applicationIdStr);
      
      // Обновление счетчиков в заявке
      const ApplicationModel = (await import('../models/application.model')).ApplicationModel;
      await ApplicationModel.updateVoteCounts(applicationIdStr, votes.positive, votes.negative);
      
      return true;
    } catch (error) {
      console.error(`Ошибка при обновлении счетчика голосов в заявке ${applicationId}:`, error);
      return false;
    }
  }

  /**
   * Уведомление автора заявки о новом голосе
   * @param application - Заявка
   * @param isPositive - Тип голоса (положительный/отрицательный)
   */
  private async notifyApplicantAboutVote(application: Application, isPositive: boolean): Promise<void> {
    try {
      const voteIcon = isPositive ? '👍' : '👎';
      const voteText = isPositive ? 'положительный' : 'отрицательный';
      
      // Преобразуем ID в строку, чтобы избежать проблем с BigInt
      const applicationIdStr = String(application.id);
      
      await this.bot.api.sendMessage(
        String(application.telegramId),
        `${voteIcon} По вашей заявке #${applicationIdStr} получен ${voteText} голос.\n\n` +
        `Текущий статус голосования: 👍 ${application.votesPositive + (isPositive ? 1 : 0)} / 👎 ${application.votesNegative + (isPositive ? 0 : 1)}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error(`Ошибка при отправке уведомления о голосе автору заявки ${application.telegramId}:`, error);
    }
  }

  /**
   * Отправка ответа на вопрос пользователю, который задал вопрос
   * @param fromTelegramId - Telegram ID отвечающего (заявитель)
   * @param toTelegramId - Telegram ID пользователя, которому отправляется ответ
   * @param applicationId - ID заявки
   * @param answer - Текст ответа
   * @returns true, если ответ успешно отправлен
   */
  async sendAnswerToQuestion(fromTelegramId: number, toTelegramId: number, applicationId: number, answer: string): Promise<boolean> {
    try {
      console.log(`Отправка ответа на вопрос: fromTelegramId=${fromTelegramId}, toTelegramId=${toTelegramId}, applicationId=${applicationId}`);
      
      // Получение информации о пользователе, который отвечает
      const fromUser = await UserModel.getByTelegramId(fromTelegramId);
      if (!fromUser) {
        console.error(`Пользователь-отправитель не найден: telegramId=${fromTelegramId}`);
        return false;
      }
      
      // Получение информации о заявке
      const application = await this.getApplicationById(applicationId);
      if (!application) {
        console.error(`Заявка не найдена: applicationId=${applicationId}`);
        return false;
      }
      
      // Преобразуем telegramId к строкам для надежного сравнения
      const fromTelegramIdStr = String(fromTelegramId);
      const applicationTelegramIdStr = String(application.telegramId);
      
      console.log(`Сравнение telegramId (строки): fromTelegramId=${fromTelegramIdStr}, application.telegramId=${applicationTelegramIdStr}`);
      
      // Проверяем строковые представления для устранения проблем с типами
      if (fromTelegramIdStr !== applicationTelegramIdStr) {
        console.error(`Пользователь ${fromTelegramId} не является автором заявки ${applicationId}. TelegramId автора: ${application.telegramId}`);
        return false;
      }
      
      // Отправка ответа пользователю, задавшему вопрос
      const applicationIdStr = String(applicationId);
      const keyboard = new InlineKeyboard()
        .text("Задать ещё вопрос", `ask_${applicationIdStr}`)
        .row()
        .text("На главную", "start");
      
      await this.bot.api.sendMessage(
        String(toTelegramId),
        `📝 *Ответ на ваш вопрос по заявке #${applicationIdStr}*\n\n` +
        `От: ${fromUser.firstName} ${fromUser.lastName || ''} (${application.minecraftUsername})\n\n` +
        `💬 *Ответ*: ${answer}`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
      console.log(`Ответ на вопрос успешно отправлен пользователю ${toTelegramId}`);
      return true;
    } catch (error) {
      console.error(`Ошибка при отправке ответа на вопрос: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 