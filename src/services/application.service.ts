import { User, UserModel, UserRole } from '../models/user.model';
import { Application, ApplicationModel, ApplicationStatus } from '../models/application.model';
import { Vote, VoteModel, VoteType } from '../models/vote.model';
import { Question, QuestionModel } from '../models/question.model';
import { MinecraftService } from './minecraft.service';
import { executeQuery } from '../database/connection';
import dotenv from 'dotenv';
import { NotificationService } from './notification.service';
import { KeyboardService } from './keyboard.service';
import { RoleController } from '../controllers/role.controller';

// Загрузка переменных окружения
dotenv.config();

/**
 * Сервис для обработки заявок на вступление в сервер
 */
export class ApplicationService {
  private minecraftService: MinecraftService;
  private votingDuration: number; // Длительность голосования в часах
  private minVotes: number; // Минимальное количество голосов для принятия решения
  private minVoteParticipationPercent: number; // Минимальный процент участия в голосовании
  private approvalThresholdPercent: number; // Порог для одобрения заявки
  private rejectionThresholdPercent: number; // Порог для отклонения заявки
  private smallCommunityThreshold: number; // Порог для определения малого сообщества
  private notificationService?: NotificationService; // Опциональный сервис уведомлений
  private keyboardService?: KeyboardService; // Опциональный сервис клавиатуры
  private roleController?: RoleController; // Опциональный контроллер ролей

  constructor(notificationService?: NotificationService, keyboardService?: KeyboardService, roleController?: RoleController) {
    this.minecraftService = new MinecraftService();
    this.votingDuration = Number(process.env.VOTING_DURATION_HOURS) || 24;
    this.minVotes = Number(process.env.MIN_VOTES) || 3;
    this.minVoteParticipationPercent = Number(process.env.MIN_VOTE_PARTICIPATION_PERCENT) || 40;
    this.approvalThresholdPercent = Number(process.env.APPROVAL_THRESHOLD_PERCENT) || 60;
    this.rejectionThresholdPercent = Number(process.env.REJECTION_THRESHOLD_PERCENT) || 60;
    this.smallCommunityThreshold = Number(process.env.SMALL_COMMUNITY_THRESHOLD) || 5;
    this.notificationService = notificationService;
    this.keyboardService = keyboardService;
    this.roleController = roleController;
    
    console.log(`Инициализация ApplicationService:
    - Длительность голосования: ${this.votingDuration} ч.
    - Минимум голосов: ${this.minVotes}
    - Мин. процент участия: ${this.minVoteParticipationPercent}%
    - Порог одобрения: ${this.approvalThresholdPercent}%
    - Порог отклонения: ${this.rejectionThresholdPercent}%
    - Порог малого сообщества: ${this.smallCommunityThreshold} чел.`);
    
    // Если roleController не передан, но есть notificationService с bot, создаем новый
    if (!this.roleController && this.notificationService) {
      try {
        // @ts-ignore - доступ к приватному полю
        const bot = this.notificationService.bot;
        if (bot) {
          this.roleController = new RoleController(bot);
        }
      } catch (error) {
        console.error('Не удалось создать RoleController:', error);
      }
    }
  }

  /**
   * Создание новой заявки
   * @param telegramId - ID пользователя в Telegram
   * @param minecraftUsername - Имя в Minecraft
   * @param reason - Причина заявки
   * @returns Созданная заявка или null в случае ошибки
   */
  async createApplication(telegramId: number, minecraftUsername: string, reason: string): Promise<Application | null> {
    try {
      // Получение пользователя из базы данных или создание нового
      let user = await UserModel.getByTelegramId(telegramId);
      
      if (!user) {
        // Если пользователь не найден, возвращаем ошибку
        // Пользователь должен быть создан при первом взаимодействии с ботом
        console.error('Пользователь не найден:', telegramId);
        return null;
      }

      // Проверка, есть ли у пользователя активная заявка
      const existingApplication = await ApplicationModel.getLastByTelegramId(telegramId);
      if (existingApplication && existingApplication.status === ApplicationStatus.PENDING) {
        // У пользователя уже есть активная заявка
        return existingApplication;
      }

      // Расчет времени окончания голосования
      const votingEndsAt = new Date();
      votingEndsAt.setHours(votingEndsAt.getHours() + this.votingDuration);

      // Создание новой заявки
      const application = await ApplicationModel.create({
        userId: user.id!,
        telegramId,
        minecraftUsername,
        reason,
        votingEndsAt
      });

      // Получение UUID игрока в Minecraft
      const uuid = await this.minecraftService.getPlayerUUID(minecraftUsername);
      if (uuid) {
        await ApplicationModel.updateMinecraftUUID(application.id as number, uuid);
        application.minecraftUUID = uuid;
      }

      return application;
    } catch (error) {
      console.error('Ошибка при создании заявки:', error);
      return null;
    }
  }

  /**
   * Получение последней заявки пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Последняя заявка пользователя или null
   */
  async getLastApplication(telegramId: number): Promise<Application | null> {
    try {
      return await ApplicationModel.getLastByTelegramId(telegramId);
    } catch (error) {
      console.error('Ошибка при получении последней заявки:', error);
      return null;
    }
  }

  /**
   * Получение заявки по ID
   * @param applicationId - ID заявки
   * @returns Заявка или null, если не найдена
   */
  async getApplicationById(applicationId: number | string): Promise<Application | null> {
    try {
      return await ApplicationModel.getById(applicationId);
    } catch (error) {
      console.error('Ошибка при получении заявки по ID:', error);
      return null;
    }
  }

  /**
   * Получение списка активных заявок (на голосовании)
   * @returns Массив активных заявок
   */
  async getActiveApplications(): Promise<Application[]> {
    try {
      const pendingApplications = await ApplicationModel.getActiveApplications();
      return pendingApplications;
    } catch (error) {
      console.error('Ошибка при получении активных заявок:', error);
      return [];
    }
  }

  /**
   * Получение общего количества заявок
   * @returns Количество заявок
   */
  async getApplicationCount(): Promise<number> {
    try {
      const result = await executeQuery<{count: number}[]>('SELECT COUNT(*) as count FROM applications', []);
      return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
    } catch (error) {
      console.error('Ошибка при получении количества заявок:', error);
      return 0;
    }
  }

  /**
   * Получение количества заявок в статусе "На рассмотрении"
   * @returns Количество заявок на рассмотрении
   */
  async getPendingApplicationCount(): Promise<number> {
    try {
      const result = await executeQuery<{count: number}[]>(
        'SELECT COUNT(*) as count FROM applications WHERE status = ?',
        [ApplicationStatus.PENDING]
      );
      return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
    } catch (error) {
      console.error('Ошибка при получении количества заявок на рассмотрении:', error);
      return 0;
    }
  }

  /**
   * Получение количества одобренных заявок
   * @returns Количество одобренных заявок
   */
  async getApprovedApplicationCount(): Promise<number> {
    try {
      const result = await executeQuery<{count: number}[]>(
        'SELECT COUNT(*) as count FROM applications WHERE status = ?',
        [ApplicationStatus.APPROVED]
      );
      return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
    } catch (error) {
      console.error('Ошибка при получении количества одобренных заявок:', error);
      return 0;
    }
  }

  /**
   * Получение количества отклоненных заявок
   * @returns Количество отклоненных заявок
   */
  async getRejectedApplicationCount(): Promise<number> {
    try {
      const result = await executeQuery<{count: number}[]>(
        'SELECT COUNT(*) as count FROM applications WHERE status IN (?, ?)',
        [ApplicationStatus.REJECTED, ApplicationStatus.EXPIRED]
      );
      return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
    } catch (error) {
      console.error('Ошибка при получении количества отклоненных заявок:', error);
      return 0;
    }
  }

  /**
   * Голосование за заявку
   * @param applicationId - ID заявки
   * @param voterId - ID пользователя, который голосует
   * @param isPositive - Положительный или отрицательный голос
   * @returns true, если голос успешно добавлен
   */
  async voteForApplication(applicationId: number | string, voterId: number, isPositive: boolean): Promise<boolean> {
    try {
      // Проверка существования заявки
      const application = await ApplicationModel.getById(applicationId);
      if (!application || application.status !== ApplicationStatus.PENDING) {
        console.error('Заявка не найдена или не в состоянии голосования:', applicationId);
        return false;
      }

      // Проверка, голосовал ли пользователь ранее
      const hasVoted = await VoteModel.hasUserVoted(voterId, applicationId);
      if (hasVoted) {
        console.error('Пользователь уже голосовал за эту заявку:', voterId);
        return false;
      }

      // Проверка, может ли пользователь голосовать
      const voter = await UserModel.getByTelegramId(voterId);
      if (!voter || !voter.canVote) {
        console.error('Пользователь не имеет права голоса:', voterId);
        return false;
      }

      // Создание голоса
      await VoteModel.create({
        applicationId,
        userId: voter.id!,
        voteType: isPositive ? VoteType.POSITIVE : VoteType.NEGATIVE
      });

      // Обновление счетчика голосов в заявке
      await ApplicationModel.addVote(applicationId as number, isPositive);

      // Проверка результатов голосования
      await this.checkVotingResult(applicationId);

      return true;
    } catch (error) {
      console.error('Ошибка при голосовании за заявку:', error);
      return false;
    }
  }

  /**
   * Добавление вопроса к заявке
   * @param applicationId - ID заявки
   * @param fromUserId - ID пользователя, который задает вопрос
   * @param questionText - Текст вопроса
   * @returns Созданный вопрос или null в случае ошибки
   */
  async addQuestion(applicationId: number | string, fromUserId: number, questionText: string): Promise<Question | null> {
    try {
      // Проверка существования заявки
      const application = await ApplicationModel.getById(applicationId);
      if (!application || application.status !== ApplicationStatus.PENDING) {
        console.error('Заявка не найдена или не в состоянии голосования:', applicationId);
        return null;
      }

      // Проверка, может ли пользователь задавать вопросы
      const user = await UserModel.getByTelegramId(fromUserId);
      if (!user || !user.canVote) {
        console.error('Пользователь не имеет права задавать вопросы:', fromUserId);
        return null;
      }

      // Создание вопроса
      return await QuestionModel.create({
        applicationId: Number(applicationId), // Преобразуем к number, так как QuestionModel.create ожидает number
        fromUserId: user.id!,
        question: questionText
      });
    } catch (error) {
      console.error('Ошибка при добавлении вопроса к заявке:', error);
      return null;
    }
  }

  /**
   * Добавление ответа на вопрос
   * @param questionId - ID вопроса
   * @param answer - Текст ответа
   * @returns true, если ответ успешно добавлен
   */
  async addAnswer(questionId: number, answer: string): Promise<boolean> {
    try {
      return await QuestionModel.addAnswer(questionId, answer);
    } catch (error) {
      console.error('Ошибка при добавлении ответа на вопрос:', error);
      return false;
    }
  }

  /**
   * Проверка результатов голосования по заявке
   * @param applicationId - ID заявки
   * @returns true, если статус заявки был изменен
   */
  async checkVotingResult(applicationId: number | string): Promise<boolean> {
    try {
      // Получение заявки
      const application = await ApplicationModel.getById(applicationId);
      
      if (!application || application.status !== ApplicationStatus.PENDING) {
        console.error('Заявка не найдена или не в состоянии голосования:', applicationId);
        return false;
      }
      
      // Получение пользователя
      const user = await UserModel.getByTelegramId(application.telegramId);
      
      if (!user || !user.id) {
        console.error('Пользователь не найден:', application.telegramId);
        return false;
      }
      
      // Проверка, завершилось ли время голосования
      const now = new Date();
      const votingEndsAt = new Date(application.votingEndsAt);
      
      if (now < votingEndsAt) {
        // Время голосования еще не закончилось
        return false;
      }
      
      // Получаем общее количество пользователей с правом голоса
      const totalVotersCount = await UserModel.getVotersCount();
      
      // Подсчет общего количества проголосовавших по этой заявке
      const totalVotes = application.votesPositive + application.votesNegative;
      
      // Проверка, является ли сообщество малым
      const isSmallCommunity = totalVotersCount <= this.smallCommunityThreshold;
      
      // Вычисляем минимально необходимое количество голосов
      let requiredVotesPercent = this.minVoteParticipationPercent;
      if (isSmallCommunity) {
        requiredVotesPercent = Math.min(60, this.minVoteParticipationPercent * 1.5); // Увеличиваем для маленьких сообществ
      }
      
      // Минимальное количество голосов (абсолютное значение)
      const requiredVotesCount = Math.max(
        Math.ceil(totalVotersCount * requiredVotesPercent / 100), 
        isSmallCommunity ? 1 : this.minVotes // Если сообщество слишком маленькое, то минимум 1 голос
      );
      
      // Процент проголосовавших от общего числа пользователей с правом голоса
      const participationPercent = totalVotersCount > 0 ? 
        (totalVotes / totalVotersCount) * 100 : 0;
      
      // Процент голосов "за" от общего числа голосов
      const positivePercent = totalVotes > 0 ? 
        (application.votesPositive / totalVotes) * 100 : 0;
      
      // Процент голосов "против" от общего числа голосов
      const negativePercent = totalVotes > 0 ? 
        (application.votesNegative / totalVotes) * 100 : 0;
      
      console.log(`Заявка #${application.id}: Голосов: ${totalVotes}/${totalVotersCount} (${participationPercent.toFixed(1)}%), За: ${positivePercent.toFixed(1)}%, Против: ${negativePercent.toFixed(1)}%`);
      
      // Определение нового статуса заявки
      let newStatus: ApplicationStatus;
      let systemAction: string;
      
      // Проверка, достаточно ли проголосовало людей
      const sufficientVotes = totalVotes >= requiredVotesCount;
      
      // Особый случай: если проголосовали все, кто имеет право голоса
      const allVoted = totalVotes >= totalVotersCount;
      
      if (!sufficientVotes && !allVoted) {
        // Недостаточно голосов
        newStatus = ApplicationStatus.EXPIRED;
        systemAction = `отклонена из-за недостаточного количества голосов (${totalVotes}/${requiredVotesCount})`;
      } else if (positivePercent >= this.approvalThresholdPercent) {
        // Достаточный процент голосов "за"
        newStatus = ApplicationStatus.APPROVED;
        systemAction = `одобрена большинством голосов (${positivePercent.toFixed(1)}%)`;
        
        // Обновляем роль пользователя на MEMBER
        if (this.roleController) {
          await this.roleController.setMemberRole(application.telegramId);
        } else {
          // Запасной вариант, если RoleController недоступен
          await UserModel.updateRole(user.id, UserRole.MEMBER);
          await UserModel.updateVotePermission(user.id, true);
          
          if (this.keyboardService) {
            await this.keyboardService.setCommands(application.telegramId, UserRole.MEMBER);
          }
        }
        
        // Добавляем пользователя в белый список Minecraft-сервера
        const minecraftUUID = application.minecraftUUID || await this.minecraftService.getPlayerUUID(application.minecraftUsername);
        
        if (minecraftUUID) {
          // Добавление в белый список
          await this.minecraftService.addToWhitelist(application.minecraftUsername, minecraftUUID);
          
          // Обновление UUID в базе данных, если его не было
          if (!application.minecraftUUID) {
            await ApplicationModel.updateMinecraftUUID(application.id as number, minecraftUUID);
          }
          
          // Обновление UUID пользователя
          await UserModel.update(user.id, {
            minecraftUsername: application.minecraftUsername,
            minecraftUUID: minecraftUUID
          });
        }
      } else if (negativePercent >= this.rejectionThresholdPercent) {
        // Достаточный процент голосов "против"
        newStatus = ApplicationStatus.REJECTED;
        systemAction = `отклонена большинством голосов против (${negativePercent.toFixed(1)}%)`;
      } else {
        // Неопределенная ситуация - нет явного большинства
        newStatus = ApplicationStatus.EXPIRED;
        systemAction = `отклонена из-за отсутствия явного большинства голосов (за: ${positivePercent.toFixed(1)}%, против: ${negativePercent.toFixed(1)}%)`;
      }
      
      // Обновление статуса заявки
      const statusUpdated = await ApplicationModel.updateStatus(applicationId, newStatus);
      
      if (statusUpdated) {
        // Уведомление пользователя о результате
        this.notifyUserAboutApplicationResult(application, newStatus, systemAction);
      }
      
      return statusUpdated;
    } catch (error) {
      console.error('Ошибка при проверке результатов голосования:', error);
      return false;
    }
  }

  /**
   * Проверка заявок с истекшим сроком голосования
   * @returns Количество обработанных заявок
   */
  async checkExpiredApplications(): Promise<number> {
    try {
      // Получение заявок с истекшим сроком голосования
      const expiredApplications = await ApplicationModel.getExpiredApplications();
      
      let processedCount = 0;
      
      // Обработка каждой заявки
      for (const application of expiredApplications) {
        const processed = await this.checkVotingResult(application.id!);
        if (processed) {
          processedCount++;
        }
      }
      
      return processedCount;
    } catch (error) {
      console.error('Ошибка при проверке истекших заявок:', error);
      return 0;
    }
  }

  /**
   * Изменение статуса заявки администратором
   * @param applicationId - ID заявки
   * @param newStatus - Новый статус
   * @param adminId - ID администратора
   * @returns true, если статус успешно изменен
   */
  async adminChangeStatus(applicationId: number | string, newStatus: ApplicationStatus, adminId: number): Promise<boolean> {
    try {
      // Получение заявки
      const application = await ApplicationModel.getById(applicationId);
      
      if (!application) {
        console.error('Заявка не найдена:', applicationId);
        return false;
      }
      
      // Получение пользователя, подавшего заявку
      const user = await UserModel.getByTelegramId(application.telegramId);
      
      if (!user || !user.id) {
        console.error('Пользователь не найден:', application.telegramId);
        return false;
      }
      
      // Получение информации об администраторе
      const admin = await UserModel.getByTelegramId(adminId);
      
      if (!admin) {
        console.error('Администратор не найден:', adminId);
        return false;
      }
      
      // Обработка нового статуса
      if (newStatus === ApplicationStatus.APPROVED) {
        // Обновляем роль пользователя на MEMBER
        if (this.roleController) {
          await this.roleController.setMemberRole(application.telegramId);
        } else {
          // Запасной вариант, если RoleController недоступен
          await UserModel.updateRole(user.id, UserRole.MEMBER);
          await UserModel.updateVotePermission(user.id, true);
          
          if (this.keyboardService) {
            await this.keyboardService.setCommands(application.telegramId, UserRole.MEMBER);
          }
        }
        
        // Добавляем пользователя в белый список Minecraft-сервера
        const minecraftUUID = application.minecraftUUID || await this.minecraftService.getPlayerUUID(application.minecraftUsername);
        
        if (minecraftUUID) {
          // Добавление в белый список
          await this.minecraftService.addToWhitelist(application.minecraftUsername, minecraftUUID);
          
          // Обновление UUID в базе данных, если его не было
          if (!application.minecraftUUID) {
            await ApplicationModel.updateMinecraftUUID(application.id as number, minecraftUUID);
          }
          
          // Обновление UUID пользователя
          await UserModel.update(user.id, {
            minecraftUsername: application.minecraftUsername,
            minecraftUUID: minecraftUUID
          });
        }
      } else if (newStatus === ApplicationStatus.BANNED) {
        // Если заявка блокируется, то убираем право голоса
        await UserModel.updateVotePermission(user.id, false);
      }
      
      // Обновление статуса заявки
      const statusUpdated = await ApplicationModel.updateStatus(applicationId, newStatus);
      
      if (statusUpdated) {
        // Уведомление пользователя о результате
        await this.notifyUserAboutAdminAction(application, newStatus, admin);
      }
      
      return statusUpdated;
    } catch (error) {
      console.error('Ошибка при изменении статуса заявки администратором:', error);
      return false;
    }
  }

  /**
   * Уведомление пользователя о результате рассмотрения заявки
   * @param application - Заявка
   * @param status - Новый статус заявки
   * @param systemAction - Описание действия системы
   */
  private async notifyUserAboutApplicationResult(application: Application, status: ApplicationStatus, systemAction: string): Promise<void> {
    if (!this.notificationService) {
      console.error('NotificationService не доступен для отправки уведомления о результате заявки');
      return;
    }

    try {
      let message = '';
      // Подсчет голосов
      const totalVotes = application.votesPositive + application.votesNegative;
      const positivePercent = totalVotes > 0 ? 
        (application.votesPositive / totalVotes) * 100 : 0;
      const negativePercent = totalVotes > 0 ? 
        (application.votesNegative / totalVotes) * 100 : 0;
      
      // Формирование информации о голосовании
      const votingStats = `\nРезультаты голосования:\n` +
        `👥 Всего голосов: ${totalVotes}\n` +
        `👍 За: ${application.votesPositive} (${positivePercent.toFixed(1)}%)\n` +
        `👎 Против: ${application.votesNegative} (${negativePercent.toFixed(1)}%)`;
      
      switch (status) {
        case ApplicationStatus.APPROVED:
          message = `✅ Ваша заявка #${application.id} одобрена!\n\n` +
                   `Поздравляем! Теперь вы можете присоединиться к серверу. ` +
                   `Ваш ник ${application.minecraftUsername} добавлен в белый список.` +
                   votingStats;
          break;
          
        case ApplicationStatus.REJECTED:
          message = `❌ Ваша заявка #${application.id} отклонена.\n\n` +
                   `К сожалению, ваша заявка была отклонена по результатам голосования. ` +
                   `Вы можете подать новую заявку через некоторое время.` +
                   votingStats;
          break;
          
        case ApplicationStatus.EXPIRED:
          message = `⏳ Ваша заявка #${application.id} отклонена.\n\n` +
                   `${systemAction}.` +
                   votingStats + 
                   `\n\nВы можете подать новую заявку.`;
          break;
          
        case ApplicationStatus.BANNED:
          message = `🚫 Ваша заявка #${application.id} отклонена.\n\n` +
                   `Ваша заявка была отклонена администратором.`;
          break;
          
        default:
          message = `Статус вашей заявки #${application.id} изменился на "${status}".`;
          break;
      }

      // Отправка уведомления пользователю
      await this.notificationService.sendMessage(application.telegramId, message);
    } catch (error) {
      console.error('Ошибка при отправке уведомления о результате заявки:', error);
    }
  }

  /**
   * Уведомление пользователя о действии администратора
   * @param application - Заявка
   * @param status - Новый статус заявки
   * @param admin - Администратор, выполнивший действие
   */
  private async notifyUserAboutAdminAction(application: Application, status: ApplicationStatus, admin: User): Promise<void> {
    if (!this.notificationService) {
      console.error('NotificationService не доступен для отправки уведомления о действии администратора');
      return;
    }

    try {
      let message = '';
      const adminName = admin.firstName + (admin.lastName ? ` ${admin.lastName}` : '');
      
      switch (status) {
        case ApplicationStatus.APPROVED:
          message = `✅ Ваша заявка #${application.id} одобрена администратором ${adminName}!\n\n` +
                   `Поздравляем! Теперь вы можете присоединиться к серверу. ` +
                   `Ваш ник ${application.minecraftUsername} добавлен в белый список.`;
          break;
          
        case ApplicationStatus.REJECTED:
          message = `❌ Ваша заявка #${application.id} отклонена администратором ${adminName}.\n\n` +
                   `К сожалению, ваша заявка была отклонена. ` +
                   `Вы можете подать новую заявку через некоторое время.`;
          break;
          
        case ApplicationStatus.BANNED:
          message = `🚫 Ваша заявка #${application.id} заблокирована администратором ${adminName}.\n\n` +
                   `Ваша заявка была заблокирована за нарушение правил. ` +
                   `Для уточнения деталей обратитесь к администрации.`;
          break;
          
        default:
          message = `ℹ️ Статус вашей заявки #${application.id} изменен администратором ${adminName} на "${status}".`;
      }
      
      // Отправляем уведомление пользователю
      await this.notificationService.sendMessage(application.telegramId, message);
      
      console.log(`Уведомление о действии администратора по заявке ${application.id} отправлено пользователю ${application.telegramId}`);
    } catch (error) {
      console.error(`Ошибка при отправке уведомления о действии администратора по заявке ${application.id}:`, error);
    }
  }
} 