import { Context, SessionFlavor, InlineKeyboard } from 'grammy';
import { ProfileService } from '../services/profile.service';
import { UserModel, UserRole } from '../models/user.model';

// Определение типа для сессии
interface SessionData {
  profileAction?: string;
  minecraftUsername?: string;
}

// Расширенный тип контекста с сессией
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * Контроллер для работы с профилями пользователей
 */
export class ProfileController {
  /**
   * Обработчик команды /profile для просмотра профиля
   * @param ctx - Контекст Telegram
   */
  async showProfile(ctx: MyContext): Promise<void> {
    try {
      // Проверяем, существует ли пользователь
      const userExists = await ProfileService.userExists(ctx.from!.id);
      
      if (!userExists) {
        // Создаем нового пользователя, если он не существует
        await ProfileService.createUserProfile({
          telegramId: ctx.from!.id,
          username: ctx.from!.username,
          firstName: ctx.from!.first_name,
          lastName: ctx.from!.last_name,
          role: UserRole.NEW,
          canVote: false
        });
      }
      
      // Получаем расширенный профиль пользователя
      const profile = await ProfileService.getUserProfile(ctx.from!.id);
      
      if (!profile) {
        await ctx.reply('Ошибка при получении профиля. Пожалуйста, попробуйте позже.', {
          reply_markup: new InlineKeyboard().text("На главную", "start")
        });
        return;
      }
      
      // Формируем текст профиля
      let profileText = `📋 *Ваш профиль*\n\n`;
      profileText += `👤 *Имя*: ${profile.firstName}`;
      if (profile.lastName) profileText += ` ${profile.lastName}`;
      if (profile.username) profileText += ` (@${profile.username})`;
      profileText += '\n';
      
      // Добавляем информацию о Minecraft
      if (profile.minecraftUsername) {
        profileText += `🎮 *Ник в Minecraft*: ${profile.minecraftUsername}\n`;
        profileText += `🔐 *Статус в вайтлисте*: ${profile.whitelistStatus ? '✅ Добавлен' : '❌ Не добавлен'}\n`;
      } else {
        profileText += `🎮 *Ник в Minecraft*: Не указан\n`;
      }
      
      // Добавляем информацию о роли и правах
      profileText += `🏅 *Роль*: ${this.getRoleDisplay(profile.role)}\n`;
      profileText += `🗳️ *Право голоса*: ${profile.canVote ? '✅ Есть' : '❌ Нет'}\n\n`;
      
      // Добавляем статистику пользователя
      profileText += `📊 *Статистика*\n`;
      profileText += `📝 *Всего заявок*: ${profile.totalApplications}\n`;
      profileText += `📊 *Репутация*: ${profile.reputation || 0} (👍 ${profile.positiveVotes} / 👎 ${profile.negativeVotes})\n`;
      
      // Добавляем информацию о активной заявке, если есть
      if (profile.activeApplication) {
        profileText += `\n📋 *Активная заявка*\n`;
        profileText += `🆔 *ID*: ${profile.activeApplication.id}\n`;
        profileText += `🎮 *Ник*: ${profile.activeApplication.minecraftUsername}\n`;
        profileText += `📅 *Создана*: ${profile.activeApplication.created.toLocaleString()}\n`;
        profileText += `⏳ *Статус голосования*: 👍 ${profile.activeApplication.votesPositive} / 👎 ${profile.activeApplication.votesNegative}\n`;
      }
      
      // Создаем клавиатуру с действиями
      const keyboard = new InlineKeyboard();
      
      // Опция изменения ника в Minecraft
      keyboard.text("Изменить ник в Minecraft", "edit_minecraft_username");
      keyboard.row();
      
      // Просмотр истории заявок
      keyboard.text("История заявок", "application_history");
      keyboard.row();
      
      // Просмотр истории голосов (если есть право голоса)
      if (profile.canVote) {
        keyboard.text("История голосов", "voting_history");
        keyboard.row();
      }
      
      // Подать новую заявку (если нет активной и не в вайтлисте)
      if (!profile.activeApplication && !profile.whitelistStatus) {
        keyboard.text("Подать заявку", "apply");
        keyboard.row();
      }
      
      // Возврат в главное меню
      keyboard.text("На главную", "start");
      
      // Отправляем профиль
      await ctx.reply(profileText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Ошибка при отображении профиля:', error);
      await ctx.reply('Произошла ошибка при отображении профиля. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
    }
  }

  /**
   * Обработчик для изменения ника в Minecraft
   * @param ctx - Контекст Telegram
   */
  async editMinecraftUsername(ctx: MyContext): Promise<void> {
    try {
      // Устанавливаем состояние редактирования
      ctx.session.profileAction = 'edit_minecraft_username';
      
      await ctx.reply('Пожалуйста, введите ваш новый ник в Minecraft:', {
        reply_markup: new InlineKeyboard().text("Отменить", "cancel_profile_edit")
      });
    } catch (error) {
      console.error('Ошибка при запуске редактирования ника:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
    }
  }

  /**
   * Обработчик сообщений при редактировании профиля
   * @param ctx - Контекст Telegram
   */
  async processProfileEditing(ctx: MyContext): Promise<void> {
    try {
      // Проверяем, что пользователь находится в режиме редактирования профиля
      if (!ctx.session.profileAction) {
        return;
      }

      // Обрабатываем действие
      switch (ctx.session.profileAction) {
        case 'edit_minecraft_username':
          if (ctx.message && 'text' in ctx.message) {
            const minecraftUsername = ctx.message.text?.trim() || '';
            
            // Проверяем, что ник не пустой
            if (!minecraftUsername) {
              await ctx.reply('Ник не может быть пустым. Пожалуйста, введите ваш ник в Minecraft:', {
                reply_markup: new InlineKeyboard().text("Отменить", "cancel_profile_edit")
              });
              return;
            }
            
            // Обновляем ник в профиле
            const updated = await ProfileService.updateUserProfile(ctx.from!.id, {
              minecraftUsername
            });
            
            // Сбрасываем состояние редактирования
            ctx.session.profileAction = undefined;
            
            if (updated) {
              await ctx.reply(`Ваш ник в Minecraft успешно обновлен на: ${minecraftUsername}`, {
                reply_markup: new InlineKeyboard()
                  .text("Вернуться к профилю", "profile")
                  .row()
                  .text("На главную", "start")
              });
            } else {
              await ctx.reply('Произошла ошибка при обновлении ника. Пожалуйста, попробуйте позже.', {
                reply_markup: new InlineKeyboard()
                  .text("Вернуться к профилю", "profile")
                  .row()
                  .text("На главную", "start")
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Ошибка при обработке редактирования профиля:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
      
      // Сбрасываем состояние редактирования
      ctx.session.profileAction = undefined;
    }
  }

  /**
   * Обработчик отмены редактирования профиля
   * @param ctx - Контекст Telegram
   */
  async cancelProfileEdit(ctx: MyContext): Promise<void> {
    // Сбрасываем состояние редактирования
    ctx.session.profileAction = undefined;
    
    await ctx.reply('Редактирование профиля отменено.', {
      reply_markup: new InlineKeyboard()
        .text("Вернуться к профилю", "profile")
        .row()
        .text("На главную", "start")
    });
  }

  /**
   * Обработчик для отображения истории заявок пользователя
   * @param ctx - Контекст Telegram
   */
  async showApplicationHistory(ctx: MyContext): Promise<void> {
    try {
      // Получаем историю заявок пользователя
      const applications = await ProfileService.getUserApplicationHistory(ctx.from!.id);
      
      if (applications.length === 0) {
        await ctx.reply('У вас пока нет поданных заявок.', {
          reply_markup: new InlineKeyboard()
            .text("Вернуться к профилю", "profile")
            .row()
            .text("На главную", "start")
        });
        return;
      }
      
      // Формируем текст с историей заявок
      let historyText = `📋 *История ваших заявок*\n\n`;
      
      applications.forEach((app, index) => {
        // Добавляем разделитель между заявками
        if (index > 0) {
          historyText += `\n${'─'.repeat(20)}\n\n`;
        }
        
        historyText += `🆔 *Заявка #${app.id}*\n`;
        historyText += `🎮 *Ник в Minecraft*: ${app.minecraftUsername}\n`;
        historyText += `📅 *Дата подачи*: ${new Date(app.created).toLocaleString()}\n`;
        historyText += `🔄 *Статус*: ${this.getApplicationStatusDisplay(app.status)}\n`;
        historyText += `📊 *Голоса*: 👍 ${app.votesPositive} / 👎 ${app.votesNegative}\n`;
        historyText += `💬 *Причина*: ${app.reason}`;
      });
      
      await ctx.reply(historyText, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text("Вернуться к профилю", "profile")
          .row()
          .text("На главную", "start")
      });
    } catch (error) {
      console.error('Ошибка при отображении истории заявок:', error);
      await ctx.reply('Произошла ошибка при отображении истории заявок. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
    }
  }

  /**
   * Обработчик для отображения истории голосов пользователя
   * @param ctx - Контекст Telegram
   */
  async showVotingHistory(ctx: MyContext): Promise<void> {
    try {
      // Получаем историю голосов пользователя
      const votes = await ProfileService.getUserVotingHistory(ctx.from!.id);
      
      if (votes.length === 0) {
        await ctx.reply('У вас пока нет голосов.', {
          reply_markup: new InlineKeyboard()
            .text("Вернуться к профилю", "profile")
            .row()
            .text("На главную", "start")
        });
        return;
      }
      
      // Получаем статистику голосов
      const voteCounts = await ProfileService.getUserVoteCounts(ctx.from!.id);
      
      // Формируем текст с историей голосов
      let historyText = `📋 *История ваших голосов*\n\n`;
      historyText += `📊 *Всего голосов*: ${voteCounts.total}\n`;
      historyText += `👍 *Положительных*: ${voteCounts.positive}\n`;
      historyText += `👎 *Отрицательных*: ${voteCounts.negative}\n\n`;
      
      votes.forEach((vote, index) => {
        // Добавляем разделитель между голосами
        if (index > 0) {
          historyText += `\n${'─'.repeat(20)}\n\n`;
        }
        
        historyText += `🆔 *Заявка ID*: ${vote.applicationId}\n`;
        historyText += `🎮 *Пользователь*: ${vote.minecraftUsername}\n`;
        historyText += `📅 *Дата голосования*: ${new Date(vote.created).toLocaleString()}\n`;
        historyText += `👍/👎 *Голос*: ${vote.voteType === 'positive' ? '👍 За' : '👎 Против'}\n`;
        historyText += `🔄 *Статус заявки*: ${this.getApplicationStatusDisplay(vote.status)}\n`;
      });
      
      await ctx.reply(historyText, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text("Вернуться к профилю", "profile")
          .row()
          .text("На главную", "start")
      });
    } catch (error) {
      console.error('Ошибка при отображении истории голосов:', error);
      await ctx.reply('Произошла ошибка при отображении истории голосов. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
    }
  }

  /**
   * Получение текстового представления роли пользователя
   * @param role - Роль пользователя
   * @returns Текстовое представление роли
   */
  private getRoleDisplay(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return '👑 Администратор';
      case UserRole.MEMBER:
        return '👥 Участник';
      case UserRole.NEW:
        return '🆕 Новичок';
      default:
        return role;
    }
  }

  /**
   * Получение текстового представления статуса заявки
   * @param status - Статус заявки
   * @returns Текстовое представление статуса
   */
  private getApplicationStatusDisplay(status: string): string {
    switch (status) {
      case 'pending':
        return '⏳ На рассмотрении';
      case 'approved':
        return '✅ Одобрена';
      case 'rejected':
        return '❌ Отклонена';
      case 'expired':
        return '⌛ Просрочена';
      case 'banned':
        return '🚫 Заблокирована';
      default:
        return status;
    }
  }
} 