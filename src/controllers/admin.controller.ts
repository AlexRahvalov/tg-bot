import { Context, SessionFlavor, InlineKeyboard } from 'grammy';
import { Keyboard } from 'grammy';
import { ApplicationService } from '../services/application.service';
import { UserModel, UserRole } from '../models/user.model';
import { ApplicationStatus } from '../models/application.model';
import { MinecraftService } from '../services/minecraft.service';
import { NotificationService } from '../services/notification.service';
import { ReputationService } from '../services/reputation.service';

// Определение типа для сессии
interface SessionData {
  adminAction?: string;
  adminTargetId?: number;
}

// Расширенный тип контекста с сессией
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * Контроллер для административных функций
 */
export class AdminController {
  private applicationService: ApplicationService;
  private minecraftService: MinecraftService;
  private notificationService?: NotificationService;

  constructor(applicationService?: ApplicationService, minecraftService?: MinecraftService, notificationService?: NotificationService) {
    this.applicationService = applicationService || new ApplicationService();
    this.minecraftService = minecraftService || new MinecraftService();
    this.notificationService = notificationService;
  }

  /**
   * Проверка, является ли пользователь администратором
   * @param ctx - Контекст Telegram
   * @returns true, если пользователь администратор
   */
  private async isAdmin(ctx: MyContext): Promise<boolean> {
    const user = await UserModel.getByTelegramId(ctx.from!.id);
    return user?.role === UserRole.ADMIN;
  }

  /**
   * Обработчик команды /admin
   * @param ctx - Контекст Telegram
   */
  async adminPanel(ctx: MyContext): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Создаем клавиатуру для панели администратора
      const inlineKeyboard = new InlineKeyboard()
        .text("Заявки", "admin_applications")
        .text("Пользователи", "admin_users")
        .row()
        .text("Статистика", "admin_stats")
        .text("Настройки", "admin_settings")
        .row()
        .text("Проверить соединение", "admin_test")
        .row()
        .text("На главную", "start");

      // Создаем постоянную клавиатуру для админа
      const adminKeyboard = new Keyboard()
        .text("👥 Заявки").text("👤 Пользователи")
        .row()
        .text("📊 Статистика").text("⚙️ Настройки")
        .row()
        .text("🔄 Проверить соединение")
        .row()
        .text("🔙 Основное меню")
        .resized()
        .persistent();
        
      // Отображение панели администратора
      await ctx.reply(
        'Панель администратора\n\n' +
        'Выберите необходимый раздел:',
        { reply_markup: inlineKeyboard }
      );
      
      // Отправляем постоянную клавиатуру
      await ctx.reply('Также можно использовать клавиатуру снизу для быстрого доступа к админ-функциям:', {
        reply_markup: adminKeyboard
      });
    } catch (error) {
      console.error('Ошибка при открытии панели администратора:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  }

  /**
   * Обработчик команды /admin_applications
   * @param ctx - Контекст Telegram
   */
  async adminApplications(ctx: MyContext): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение активных заявок
      const activeApplications = await this.applicationService.getActiveApplications();
      
      if (activeApplications.length === 0) {
        await ctx.reply('Активных заявок нет.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin")
        });
        return;
      }

      // Формирование сообщения со списком заявок
      let message = 'Активные заявки:\n\n';
      
      // Создаем клавиатуру для списка заявок
      const keyboard = new InlineKeyboard();
      
      for (const app of activeApplications) {
        const votesInfo = `👍 ${app.votesPositive} | 👎 ${app.votesNegative}`;
        const timeLeft = this.getTimeLeftForVoting(app.votingEndsAt);
        
        message += `ID: ${app.id}\n` +
                   `Minecraft: ${app.minecraftUsername}\n` +
                   `Голоса: ${votesInfo}\n` +
                   `${timeLeft}\n\n` +
                   `-------------------------\n\n`;
                   
        // Добавляем кнопку для каждой заявки
        keyboard.text(`Заявка #${app.id}`, `admin_app_${app.id}`).row();
      }
      
      // Добавляем кнопку "Назад"
      keyboard.text("Назад", "admin");
      
      await ctx.reply(message, { reply_markup: keyboard });
    } catch (error) {
      console.error('Ошибка при просмотре заявок администратором:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin")
      });
    }
  }

  /**
   * Обработчик команды управления конкретной заявкой
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   */
  async adminManageApplication(ctx: MyContext, applicationId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение заявки
      const application = await this.applicationService.getApplicationById(applicationId);
      
      if (!application) {
        await ctx.reply('Заявка не найдена.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
        });
        return;
      }
      
      // Получаем параметры голосования
      const minVotes = Number(process.env.MIN_VOTES) || 3;
      const minParticipationPercent = Number(process.env.MIN_VOTE_PARTICIPATION_PERCENT) || 40;
      const approvalThreshold = Number(process.env.APPROVAL_THRESHOLD_PERCENT) || 60;
      const rejectionThreshold = Number(process.env.REJECTION_THRESHOLD_PERCENT) || 60;
      
      // Получение общего количества пользователей с правом голоса
      const totalVotersCount = await UserModel.getVotersCount();

      // Подсчет общего количества проголосовавших по этой заявке
      const totalVotes = application.votesPositive + application.votesNegative;
      
      // Процент проголосовавших от общего числа пользователей с правом голоса
      const participationPercent = totalVotersCount > 0 ? 
        (totalVotes / totalVotersCount) * 100 : 0;
      
      // Процент голосов "за" от общего числа голосов
      const positivePercent = totalVotes > 0 ? 
        (application.votesPositive / totalVotes) * 100 : 0;
      
      // Процент голосов "против" от общего числа голосов
      const negativePercent = totalVotes > 0 ? 
        (application.votesNegative / totalVotes) * 100 : 0;
      
      // Минимально необходимое количество голосов
      const requiredVotesCount = Math.max(
        Math.ceil(totalVotersCount * minParticipationPercent / 100), 
        minVotes
      );

      // Формирование подробной информации о заявке
      const votesInfo = `👍 ${application.votesPositive} (${positivePercent.toFixed(1)}%) | 👎 ${application.votesNegative} (${negativePercent.toFixed(1)}%)`;
      const participationInfo = `Участие: ${totalVotes}/${totalVotersCount} (${participationPercent.toFixed(1)}%)`;
      const requiredInfo = `Минимум голосов: ${requiredVotesCount} (${minParticipationPercent}%)`;
      const thresholdInfo = `Порог одобрения: ${approvalThreshold}% | Порог отклонения: ${rejectionThreshold}%`;
      const timeLeft = this.getTimeLeftForVoting(application.votingEndsAt);
      
      let message = `Заявка №${application.id}\n\n` +
                   `Minecraft: ${application.minecraftUsername}\n` +
                   `UUID: ${application.minecraftUUID || 'Не определен'}\n` +
                   `Причина: ${application.reason}\n` +
                   `Статус: ${this.getStatusText(application.status)}\n` +
                   `Голоса: ${votesInfo}\n` +
                   `${participationInfo}\n` +
                   `${requiredInfo}\n` +
                   `${thresholdInfo}\n` +
                   `${timeLeft}\n\n` +
                   `Выберите действие:`;
      
      // Создаем клавиатуру для управления заявкой
      const keyboard = new InlineKeyboard()
        .text("✅ Одобрить", `admin_approve_${application.id}`)
        .text("❌ Отклонить", `admin_reject_${application.id}`)
        .row()
        .text("🚫 Заблокировать", `admin_ban_${application.id}`)
        .row()
        .text("Назад", "admin_applications");
                   
      await ctx.reply(message, { reply_markup: keyboard });
    } catch (error) {
      console.error('Ошибка при управлении заявкой:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
      });
    }
  }

  /**
   * Обработчик команды одобрения заявки администратором
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   */
  async adminApproveApplication(ctx: MyContext, applicationId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Изменение статуса заявки
      const result = await this.applicationService.adminChangeStatus(
        applicationId,
        ApplicationStatus.APPROVED,
        ctx.from!.id
      );
      
      if (result) {
        await ctx.reply(`Заявка №${applicationId} была одобрена. Игрок добавлен в белый список сервера.`, {
          reply_markup: new InlineKeyboard()
            .text("Назад к заявкам", "admin_applications")
            .row()
            .text("Панель администратора", "admin")
        });
      } else {
        await ctx.reply('Не удалось изменить статус заявки. Возможно, она не существует или уже обработана.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
        });
      }
    } catch (error) {
      console.error('Ошибка при одобрении заявки:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
      });
    }
  }

  /**
   * Обработчик команды отклонения заявки администратором
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   */
  async adminRejectApplication(ctx: MyContext, applicationId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Изменение статуса заявки
      const result = await this.applicationService.adminChangeStatus(
        applicationId,
        ApplicationStatus.REJECTED,
        ctx.from!.id
      );
      
      if (result) {
        await ctx.reply(`Заявка №${applicationId} была отклонена.`, {
          reply_markup: new InlineKeyboard()
            .text("Назад к заявкам", "admin_applications")
            .row()
            .text("Панель администратора", "admin")
        });
      } else {
        await ctx.reply('Не удалось изменить статус заявки. Возможно, она не существует или уже обработана.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
        });
      }
    } catch (error) {
      console.error('Ошибка при отклонении заявки:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
      });
    }
  }

  /**
   * Обработчик команды блокировки заявки администратором
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   */
  async adminBanApplication(ctx: MyContext, applicationId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Изменение статуса заявки
      const result = await this.applicationService.adminChangeStatus(
        applicationId,
        ApplicationStatus.BANNED,
        ctx.from!.id
      );
      
      if (result) {
        await ctx.reply(`Заявка №${applicationId} была заблокирована.`, {
          reply_markup: new InlineKeyboard()
            .text("Назад к заявкам", "admin_applications")
            .row()
            .text("Панель администратора", "admin")
        });
      } else {
        await ctx.reply('Не удалось изменить статус заявки. Возможно, она не существует или уже обработана.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
        });
      }
    } catch (error) {
      console.error('Ошибка при блокировке заявки:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin_applications")
      });
    }
  }

  /**
   * Обработчик команды /admin_users
   * @param ctx - Контекст Telegram
   */
  async adminUsers(ctx: MyContext): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение всех пользователей
      const users = await UserModel.getAllUsers();
      
      if (users.length === 0) {
        await ctx.reply('Пользователей не найдено.', {
          reply_markup: new InlineKeyboard().text("Назад", "admin")
        });
        return;
      }

      // Формирование сообщения со списком пользователей
      let message = 'Пользователи:\n\n';
      
      // Создаем клавиатуру
      const keyboard = new InlineKeyboard();
      
      for (const user of users) {
        const roleText = this.getRoleText(user.role);
        const voteStatus = user.canVote ? '✓ Может голосовать' : '✗ Не может голосовать';
        
        message += `ID: ${user.id}\n` +
                   `Telegram: ${user.telegramId}\n` +
                   `Имя: ${user.firstName} ${user.lastName || ''}\n` +
                   `Minecraft: ${user.minecraftUsername || 'Не указан'}\n` +
                   `Роль: ${roleText}\n` +
                   `${voteStatus}\n\n` +
                   `-------------------------\n\n`;
                   
        // Добавляем кнопку для каждого пользователя
        keyboard.text(`Пользователь #${user.id}`, `admin_user_${user.id}`).row();
      }
      
      // Добавляем кнопку "Назад"
      keyboard.text("Назад", "admin");
      
      await ctx.reply(message, { reply_markup: keyboard });
    } catch (error) {
      console.error('Ошибка при просмотре пользователей:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin")
      });
    }
  }

  /**
   * Обработчик для управления отдельным пользователем
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async adminManageUser(ctx: MyContext, userId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Формирование сообщения с данными пользователя
      const roleText = this.getRoleText(user.role);
      const voteStatus = user.canVote ? '✓ Может голосовать' : '✗ Не может голосовать';
      const minecraftStatus = user.minecraftUsername ? `✓ Minecraft: ${user.minecraftUsername}` : '✗ Minecraft не указан';
      
      let message = `👤 *Управление пользователем #${user.id}*\n\n`;
      message += `*Telegram ID*: ${user.telegramId}\n`;
      message += `*Имя*: ${user.firstName} ${user.lastName || ''}\n`;
      message += `*Username*: ${user.username ? '@' + user.username : 'Не указан'}\n`;
      message += `*Роль*: ${roleText}\n`;
      message += `*Статус голосования*: ${voteStatus}\n`;
      message += `*Minecraft*: ${minecraftStatus}\n`;
      message += `*Дата регистрации*: ${new Date(user.created).toLocaleString()}\n`;
      
      // Если есть данные о репутации, добавляем их
      if (user.reputation_positive !== undefined || user.reputation_negative !== undefined) {
        message += `\n*Репутация*:\n`;
        message += `👍 Положительная: ${Math.round((user.reputation_positive || 0) * 10) / 10}\n`;
        message += `👎 Отрицательная: ${Math.round((user.reputation_negative || 0) * 10) / 10}\n`;
        
        // Получаем количество пользователей с правом голоса для расчета процента
        const totalVoters = await UserModel.getVotersCount();
        const negativePercent = totalVoters > 0 && user.reputation_negative ? 
          (user.reputation_negative / totalVoters) * 100 : 0;
        
        message += `📊 Процент негативных: ${Math.round(negativePercent)}%\n`;
        
        // Если была амнистия, показываем дату
        if (user.reputation_last_reset) {
          message += `🔄 Последняя амнистия: ${new Date(user.reputation_last_reset).toLocaleString()}\n`;
        }
      }
      
      // Создаем клавиатуру для действий с пользователем
      const keyboard = new InlineKeyboard();
      
      // Кнопки для изменения роли
      keyboard.text("📊 Подробная статистика", `admin_user_stats_${user.id}`).row();
      
      // Кнопки для управления правами
      if (user.role !== UserRole.ADMIN) {
        keyboard.text("👑 Сделать администратором", `admin_user_make_admin_${user.id}`).row();
      }
      
      if (user.role !== UserRole.MEMBER && user.role !== UserRole.NEW) {
        keyboard.text("👤 Сделать участником", `admin_user_make_member_${user.id}`).row();
      }
      
      // Кнопки для управления правом голоса
      if (user.canVote) {
        keyboard.text("🚫 Отключить право голоса", `admin_user_disable_vote_${user.id}`).row();
      } else {
        keyboard.text("✅ Включить право голоса", `admin_user_enable_vote_${user.id}`).row();
      }
      
      // Кнопка для исключения из вайтлиста, если пользователь в нем есть
      if (user.minecraftUsername) {
        keyboard.text("⛔ Исключить из вайтлиста", `admin_user_remove_whitelist_${user.id}`).row();
      }
      
      // Кнопка для сброса негативных оценок
      if (user.reputation_negative && user.reputation_negative > 0) {
        keyboard.text("🔄 Сбросить негативные оценки", `admin_user_reset_negative_${user.id}`).row();
      }
      
      // Добавляем кнопки для навигации
      keyboard.text("К списку пользователей", "admin_users").row();
      keyboard.text("В панель администратора", "admin");
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Ошибка при управлении пользователем:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin_users")
      });
    }
  }

  /**
   * Обработчик команды для статистики сервера
   * @param ctx - Контекст Telegram
   */
  async adminStats(ctx: MyContext): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение статуса сервера
      const serverStatus = await this.minecraftService.getServerStatus();
      
      // Получение статистики пользователей
      const totalUsers = await UserModel.getUserCount();
      const admins = await UserModel.getAdminCount();
      const members = await UserModel.getMemberCount();
      const newUsers = await UserModel.getNewUserCount();
      
      // Получение статистики заявок
      const totalApplications = await this.applicationService.getApplicationCount();
      const pendingApplications = await this.applicationService.getPendingApplicationCount();
      const approvedApplications = await this.applicationService.getApprovedApplicationCount();
      const rejectedApplications = await this.applicationService.getRejectedApplicationCount();
      
      // Формирование сообщения со статистикой
      let message = '📊 Статистика сервера\n\n';
      
      // Статус Minecraft-сервера
      message += '🖥️ Minecraft-сервер\n';
      if (serverStatus.online) {
        message += `Статус: 🟢 Онлайн\n` +
                   `Версия: ${serverStatus.version}\n`;
         
        // Добавляем проверку наличия данных об игроках                   
        if (serverStatus.players) {
          message += `Игроки: ${serverStatus.players.online}/${serverStatus.players.max}\n`;
        }
        
        message += `MOTD: ${serverStatus.motd}\n\n`;
      } else {
        message += `Статус: 🔴 Оффлайн\n\n`;
      }
      
      // Статистика пользователей
      message += '👥 Пользователи\n' +
                 `Всего: ${totalUsers}\n` +
                 `Администраторы: ${admins}\n` +
                 `Участники: ${members}\n` +
                 `Новые: ${newUsers}\n\n`;
      
      // Статистика заявок
      message += '📝 Заявки\n' +
                 `Всего: ${totalApplications}\n` +
                 `На рассмотрении: ${pendingApplications}\n` +
                 `Одобрено: ${approvedApplications}\n` +
                 `Отклонено: ${rejectedApplications}\n`;
      
      // Добавляем клавиатуру
      const keyboard = new InlineKeyboard()
        .text("Обновить", "admin_stats")
        .row()
        .text("Назад", "admin");
      
      await ctx.reply(message, { reply_markup: keyboard });
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin")
      });
    }
  }

  /**
   * Получение времени, оставшегося до окончания голосования
   * @param votingEndsAt - Дата окончания голосования
   * @returns Строка с форматированным временем
   */
  private getTimeLeftForVoting(votingEndsAt: Date): string {
    const now = new Date();
    const timeLeftMs = votingEndsAt.getTime() - now.getTime();
    
    if (timeLeftMs <= 0) {
      return 'Голосование завершено, результаты обрабатываются.';
    }
    
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `Голосование закончится через ${hoursLeft} ч. ${minutesLeft} мин.`;
  }

  /**
   * Получение текстового представления статуса заявки
   * @param status - Статус заявки
   * @returns Текстовое представление статуса
   */
  private getStatusText(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatus.PENDING:
        return '⏳ На рассмотрении';
      case ApplicationStatus.APPROVED:
        return '✅ Одобрена';
      case ApplicationStatus.REJECTED:
        return '❌ Отклонена';
      case ApplicationStatus.EXPIRED:
        return '⌛ Истек срок';
      case ApplicationStatus.BANNED:
        return '🚫 Заблокирована';
      default:
        return 'Неизвестный статус';
    }
  }

  /**
   * Получение текстового представления роли пользователя
   * @param role - Роль пользователя
   * @returns Текстовое представление роли
   */
  private getRoleText(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return '👑 Администратор';
      case UserRole.MEMBER:
        return '👤 Участник';
      case UserRole.NEW:
        return '🆕 Новый пользователь';
      default:
        return 'Неизвестная роль';
    }
  }

  /**
   * Проверка соединения с сервером Minecraft
   * @param ctx - Контекст Telegram
   */
  async testServerConnection(ctx: MyContext): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      await ctx.reply('Начинаю проверку соединения с сервером Minecraft...');

      // Проверка статуса сервера
      const serverStatus = await this.minecraftService.getServerStatus();
      
      if (serverStatus.online) {
        await ctx.reply(
          `✅ Сервер Minecraft онлайн\n` +
          `Версия: ${serverStatus.version}\n` +
          `Игроки: ${serverStatus.players?.online || 0}/${serverStatus.players?.max || 0}\n\n` +
          `Проверяю соединение с RCON...`
        );
        
        // Проверка RCON-соединения
        const rconStatus = await this.minecraftService.testRconConnection();
        
        if (rconStatus) {
          await ctx.reply('✅ Соединение с RCON успешно установлено. Все системы работают нормально.', {
            reply_markup: new InlineKeyboard().text("Назад", "admin")
          });
        } else {
          await ctx.reply(
            '❌ Не удалось установить соединение с RCON\n\n' +
            'Возможные причины:\n' +
            '1. RCON не включен в server.properties\n' +
            '2. Неверный пароль RCON\n' +
            '3. Неверный порт RCON\n' +
            '4. Файервол блокирует соединение\n\n' +
            'Текущие настройки:\n' +
            `Хост: ${process.env.MINECRAFT_HOST || 'localhost'}\n` +
            `Порт RCON: ${process.env.MINECRAFT_RCON_PORT || '25575'}\n`,
            {
              reply_markup: new InlineKeyboard().text("Назад", "admin")
            }
          );
        }
      } else {
        await ctx.reply(
          '❌ Сервер Minecraft недоступен\n\n' +
          'Возможные причины:\n' +
          '1. Сервер не запущен\n' +
          '2. Неверный адрес сервера\n' +
          '3. Неверный порт сервера\n' +
          '4. Файервол блокирует соединение\n\n' +
          'Текущие настройки:\n' +
          `Хост: ${process.env.MINECRAFT_HOST || 'localhost'}\n` +
          `Порт: ${process.env.MINECRAFT_PORT || '25565'}\n`,
          {
            reply_markup: new InlineKeyboard().text("Назад", "admin")
          }
        );
      }
    } catch (error) {
      console.error('Ошибка при проверке соединения с сервером:', error);
      await ctx.reply('Произошла ошибка при проверке соединения с сервером.', {
        reply_markup: new InlineKeyboard().text("Назад", "admin")
      });
    }
  }

  /**
   * Показывает детальную статистику репутации пользователя
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async showUserDetailedStats(ctx: MyContext, userId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Получаем репутационный сервис
      const reputationService = new ReputationService(this.notificationService);
      
      // Получаем детальную статистику
      const reputationStats = await reputationService.getUserDetailedReputationStats(user.telegramId);
      
      if (!reputationStats) {
        await ctx.reply('Не удалось получить статистику репутации.', {
          reply_markup: new InlineKeyboard()
            .text("Назад к пользователю", `admin_user_${userId}`)
            .row()
            .text("К списку пользователей", "admin_users")
        });
        return;
      }
      
      // Формируем сообщение со статистикой
      let message = `📊 *Детальная статистика репутации*\n\n`;
      message += `👤 *Пользователь*: ${user.firstName} ${user.lastName || ''}\n`;
      message += `*ID*: ${user.id} (Telegram: ${user.telegramId})\n\n`;
      
      message += `*Основная статистика*:\n`;
      message += `👍 Положительные оценки: ${reputationStats.positive}\n`;
      message += `👎 Отрицательные оценки: ${reputationStats.negative}\n`;
      message += `📊 Процент негативных: ${Math.round(reputationStats.negativePercent)}%\n`;
      message += `⚠️ Порог исключения: ${reputationStats.threshold}%\n\n`;
      
      // Если есть негативные оценки по причинам, выводим их
      if (reputationStats.negativeReasonStats && Object.keys(reputationStats.negativeReasonStats).length > 0) {
        message += `*Негативные оценки по причинам*:\n`;
        
        for (const [reason, value] of Object.entries(reputationStats.negativeReasonStats)) {
          message += `- ${reason}: ${Math.round(value as number * 10) / 10}\n`;
        }
        
        message += '\n';
      }
      
      // Информация о последней амнистии
      if (reputationStats.lastAmnestyDate) {
        message += `*Последняя амнистия*: ${new Date(reputationStats.lastAmnestyDate).toLocaleString()}\n\n`;
      }
      
      // Информация о последних записях
      if (reputationStats.detailedRecords && reputationStats.detailedRecords.length > 0) {
        message += `*Последние оценки (макс. 5)*:\n`;
        
        // Ограничиваем количество отображаемых записей
        const records = reputationStats.detailedRecords.slice(0, 5);
        
        for (const record of records) {
          const voterName = record.voter ? 
            `${record.voter.firstName} ${record.voter.lastName || ''}` : 'Неизвестный пользователь';
          
          const voteType = record.is_positive ? '👍' : '👎';
          const reasonText = record.reason ? ` (${record.reason.name})` : '';
          
          message += `- ${voteType} от ${voterName}${reasonText}, вес: ${record.vote_weight}\n`;
        }
      }
      
      // Добавляем клавиатуру
      const keyboard = new InlineKeyboard()
        .text("Назад к пользователю", `admin_user_${userId}`)
        .row()
        .text("К списку пользователей", "admin_users");
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Ошибка при отображении статистики репутации:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
      });
    }
  }

  /**
   * Устанавливает роль пользователя
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @param role - Новая роль
   */
  async setUserRole(ctx: MyContext, userId: number, role: UserRole): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Обновление роли
      const updated = await UserModel.updateRole(userId, role);
      
      if (updated) {
        // Формируем сообщение об успешном обновлении
        const roleText = this.getRoleText(role);
        await ctx.reply(`Роль пользователя ${user.firstName} ${user.lastName || ''} успешно изменена на "${roleText}".`, {
          reply_markup: new InlineKeyboard()
            .text("Управление пользователем", `admin_user_${userId}`)
            .row()
            .text("К списку пользователей", "admin_users")
        });
        
        // Если меняем на админа, автоматически даем право голоса
        if (role === UserRole.ADMIN && !user.canVote) {
          await UserModel.updateVotePermission(userId, true);
        }
        
        // Уведомляем пользователя о смене роли
        if (this.notificationService) {
          const roleMessage = `🔄 *Изменение роли*\n\nВаша роль в системе была изменена на "${roleText}".`;
          await this.notificationService.sendMessage(user.telegramId, roleMessage);
        }
      } else {
        await ctx.reply('Не удалось обновить роль пользователя.', {
          reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
        });
      }
    } catch (error) {
      console.error('Ошибка при изменении роли пользователя:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
      });
    }
  }

  /**
   * Устанавливает право голоса пользователя
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @param canVote - Новое состояние права голоса
   */
  async setUserVotePermission(ctx: MyContext, userId: number, canVote: boolean): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Обновление права голоса
      const updated = await UserModel.updateVotePermission(userId, canVote);
      
      if (updated) {
        // Формируем сообщение об успешном обновлении
        const statusText = canVote ? 'получил право голоса' : 'лишен права голоса';
        await ctx.reply(`Пользователь ${user.firstName} ${user.lastName || ''} успешно ${statusText}.`, {
          reply_markup: new InlineKeyboard()
            .text("Управление пользователем", `admin_user_${userId}`)
            .row()
            .text("К списку пользователей", "admin_users")
        });
        
        // Уведомляем пользователя об изменении права голоса
        if (this.notificationService) {
          const voteMessage = canVote ? 
            '✅ *Право голоса активировано*\n\nВам предоставлено право голосовать за заявки и участников сообщества.' :
            '❌ *Право голоса деактивировано*\n\nВы больше не можете голосовать за заявки и участников сообщества.';
          
          await this.notificationService.sendMessage(user.telegramId, voteMessage);
        }
      } else {
        await ctx.reply('Не удалось обновить право голоса пользователя.', {
          reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
        });
      }
    } catch (error) {
      console.error('Ошибка при изменении права голоса пользователя:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
      });
    }
  }

  /**
   * Удаляет пользователя из вайтлиста Minecraft-сервера
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async removeUserFromWhitelist(ctx: MyContext, userId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Проверяем, есть ли никнейм Minecraft
      if (!user.minecraftUsername) {
        await ctx.reply('У пользователя не указан ник в Minecraft.', {
          reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
        });
        return;
      }

      // Удаляем из вайтлиста
      const removed = await this.minecraftService.removeFromWhitelist(user.minecraftUsername);
      
      if (removed) {
        await ctx.reply(`Пользователь ${user.firstName} ${user.lastName || ''} (Minecraft: ${user.minecraftUsername}) успешно удален из вайтлиста сервера.`, {
          reply_markup: new InlineKeyboard()
            .text("Управление пользователем", `admin_user_${userId}`)
            .row()
            .text("К списку пользователей", "admin_users")
        });
        
        // Уведомляем пользователя об исключении из вайтлиста
        if (this.notificationService) {
          const message = `⚠️ *Исключение из вайтлиста*\n\nВаш аккаунт Minecraft (${user.minecraftUsername}) был удален из белого списка сервера администратором.`;
          await this.notificationService.sendMessage(user.telegramId, message);
        }
      } else {
        await ctx.reply('Не удалось удалить пользователя из вайтлиста.', {
          reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
        });
      }
    } catch (error) {
      console.error('Ошибка при удалении пользователя из вайтлиста:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
      });
    }
  }

  /**
   * Сбрасывает негативные оценки пользователя
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async resetUserNegativeReputation(ctx: MyContext, userId: number): Promise<void> {
    try {
      // Проверка прав администратора
      if (!await this.isAdmin(ctx)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Получение данных пользователя
      const user = await UserModel.getById(userId);
      
      if (!user) {
        await ctx.reply('Пользователь не найден.', {
          reply_markup: new InlineKeyboard().text("К списку пользователей", "admin_users")
        });
        return;
      }

      // Обновляем поля репутации
      const updated = await UserModel.update(userId, {
        reputation_negative: 0,
        reputation_last_reset: new Date()
      });
      
      if (updated) {
        await ctx.reply(`Негативные оценки пользователя ${user.firstName} ${user.lastName || ''} успешно сброшены.`, {
          reply_markup: new InlineKeyboard()
            .text("Управление пользователем", `admin_user_${userId}`)
            .row()
            .text("К списку пользователей", "admin_users")
        });
        
        // Уведомляем пользователя о сбросе оценок
        if (this.notificationService) {
          const message = `🔄 *Амнистия репутации*\n\nАдминистратор произвел сброс ваших негативных оценок.`;
          await this.notificationService.sendMessage(user.telegramId, message);
        }
      } else {
        await ctx.reply('Не удалось сбросить негативные оценки пользователя.', {
          reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
        });
      }
    } catch (error) {
      console.error('Ошибка при сбросе негативных оценок пользователя:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("Назад", `admin_user_${userId}`)
      });
    }
  }
} 