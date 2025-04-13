import { Context } from 'grammy';
import { UserModel, UserRole } from '../models/user.model';
import { KeyboardService } from '../services/keyboard.service';
import { NotificationService } from '../services/notification.service';

/**
 * Контроллер для управления ролями пользователей
 */
export class RoleController {
  private keyboardService: KeyboardService;
  private notificationService: NotificationService;

  constructor(bot: any) {
    this.keyboardService = new KeyboardService(bot);
    this.notificationService = new NotificationService(bot);
  }

  /**
   * Установка или обновление роли пользователя
   * @param telegramId - ID пользователя в Telegram
   * @param role - Новая роль
   * @param notify - Отправлять ли уведомление пользователю
   * @returns true, если роль успешно обновлена
   */
  async setUserRole(telegramId: number, role: UserRole, notify: boolean = true): Promise<boolean> {
    try {
      // Получение пользователя
      const user = await UserModel.getByTelegramId(telegramId);
      
      if (!user || !user.id) {
        console.error(`Пользователь с Telegram ID ${telegramId} не найден`);
        return false;
      }

      // Если роль не изменилась, ничего не делаем
      if (user.role === role) {
        console.log(`Пользователь ${telegramId} уже имеет роль ${role}`);
        return true;
      }

      // Обновление роли
      const updated = await UserModel.updateRole(user.id, role);
      
      if (!updated) {
        console.error(`Не удалось обновить роль пользователя ${telegramId}`);
        return false;
      }

      // Обновление доступных команд
      await this.keyboardService.setCommands(telegramId, role);

      // Отправка уведомления пользователю
      if (notify) {
        await this.notifyUserAboutRoleChange(telegramId, role, user.role);
      }

      console.log(`Роль пользователя ${telegramId} изменена с ${user.role} на ${role}`);
      return true;
    } catch (error) {
      console.error(`Ошибка при обновлении роли пользователя ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Установка новому пользователю роли NEW
   * @param ctx - Контекст Telegram
   * @returns Объект пользователя или null в случае ошибки
   */
  async setNewUserRole(ctx: Context): Promise<any> {
    const telegramId = ctx.from?.id;
    
    if (!telegramId) {
      console.error('Не удалось получить ID пользователя из контекста');
      return null;
    }

    // Проверяем, существует ли пользователь
    let user = await UserModel.getByTelegramId(telegramId);
    
    if (user) {
      // Если пользователь уже существует, возвращаем его
      return user;
    }

    // Создаем нового пользователя с ролью NEW
    user = await UserModel.create({
      telegramId: telegramId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name || 'Пользователь',
      lastName: ctx.from?.last_name,
      role: UserRole.NEW,
      canVote: false
    });

    // Устанавливаем доступные команды
    if (user) {
      await this.keyboardService.setCommands(telegramId, UserRole.NEW);
    }

    return user;
  }

  /**
   * Установка роли GUEST после подачи заявки
   * @param telegramId - ID пользователя в Telegram
   * @returns true, если роль успешно обновлена
   */
  async setGuestRole(telegramId: number): Promise<boolean> {
    return this.setUserRole(telegramId, UserRole.GUEST);
  }

  /**
   * Установка роли MEMBER после одобрения заявки
   * @param telegramId - ID пользователя в Telegram
   * @returns true, если роль успешно обновлена
   */
  async setMemberRole(telegramId: number): Promise<boolean> {
    const result = await this.setUserRole(telegramId, UserRole.MEMBER);
    
    // Дополнительно даем право голоса
    if (result) {
      const user = await UserModel.getByTelegramId(telegramId);
      if (user && user.id) {
        await UserModel.updateVotePermission(user.id, true);
      }
    }
    
    return result;
  }

  /**
   * Установка роли ADMIN
   * @param telegramId - ID пользователя в Telegram
   * @returns true, если роль успешно обновлена
   */
  async setAdminRole(telegramId: number): Promise<boolean> {
    const result = await this.setUserRole(telegramId, UserRole.ADMIN);
    
    // Дополнительно даем право голоса
    if (result) {
      const user = await UserModel.getByTelegramId(telegramId);
      if (user && user.id) {
        await UserModel.updateVotePermission(user.id, true);
      }
    }
    
    return result;
  }

  /**
   * Отправка уведомления пользователю об изменении роли
   * @param telegramId - ID пользователя в Telegram
   * @param newRole - Новая роль
   * @param oldRole - Старая роль
   */
  private async notifyUserAboutRoleChange(telegramId: number, newRole: UserRole, oldRole: UserRole): Promise<void> {
    let message = '';
    
    switch (newRole) {
      case UserRole.GUEST:
        message = '🔄 Ваша роль обновлена до "Гость".\n\n' +
                  'Ваша заявка принята к рассмотрению. Теперь вы можете отслеживать её статус и получите уведомление после принятия решения.';
        break;
        
      case UserRole.MEMBER:
        message = '🎉 Поздравляем! Ваша роль обновлена до "Участник".\n\n' +
                  'Вы теперь полноценный участник сообщества. Теперь вы можете голосовать за заявки других пользователей и имеете доступ ко всем функциям бота.';
        break;
        
      case UserRole.ADMIN:
        message = '👑 Поздравляем! Вам присвоена роль "Администратор".\n\n' +
                  'Теперь вы имеете доступ к административным функциям бота и можете управлять заявками и пользователями.';
        break;
        
      case UserRole.NEW:
        message = '📝 Ваша роль изменена на "Новый пользователь".\n\n' +
                  'Чтобы продолжить, вам необходимо подать заявку на вступление.';
        break;
        
      default:
        message = `ℹ️ Ваша роль изменена с "${oldRole}" на "${newRole}".`;
    }
    
    await this.notificationService.sendMessage(telegramId, message);
  }
} 