import { Keyboard, InlineKeyboard } from 'grammy';
import { UserRole } from '../models/user.model';
import { MenuContext } from './keyboard.service';

/**
 * Фабрика для создания клавиатур различных типов
 * в зависимости от контекста и роли пользователя
 */
export class KeyboardFactory {
  /**
   * Создание клавиатуры в зависимости от контекста и роли пользователя
   * @param context - Контекст меню
   * @param role - Роль пользователя
   * @param params - Дополнительные параметры (опционально)
   * @returns Клавиатура или инлайн-клавиатура
   */
  createKeyboard(context: MenuContext, role: UserRole, params?: any): Keyboard | InlineKeyboard {
    switch (context) {
      case MenuContext.MAIN:
        return this.createMainMenuKeyboard(role);
      case MenuContext.PROFILE:
        return this.createProfileKeyboard(role);
      case MenuContext.USERS:
        return this.createUsersKeyboard(role);
      case MenuContext.USER_DETAILS:
        return this.createUserDetailsKeyboard(role, params?.userId);
      case MenuContext.APPLICATIONS:
        return this.createApplicationsKeyboard(role);
      case MenuContext.APPLICATION_DETAILS:
        return this.createApplicationDetailsKeyboard(role, params?.applicationId);
      case MenuContext.ADMIN_PANEL:
        return this.createAdminPanelKeyboard();
      case MenuContext.ADMIN_USERS:
        return this.createAdminUsersKeyboard();
      case MenuContext.ADMIN_APPS:
        return this.createAdminApplicationsKeyboard();
      case MenuContext.ADMIN_STATS:
        return this.createAdminStatsKeyboard();
      case MenuContext.HELP:
        return this.createHelpKeyboard(role);
      default:
        return this.createMainMenuKeyboard(role);
    }
  }

  /**
   * Создание инлайн-клавиатуры в зависимости от контекста и роли пользователя
   * @param context - Контекст меню
   * @param role - Роль пользователя
   * @param params - Дополнительные параметры (опционально)
   * @returns Инлайн-клавиатура
   */
  createInlineKeyboard(context: MenuContext, role: UserRole, params?: any): InlineKeyboard {
    switch (context) {
      case MenuContext.MAIN:
        return this.createMainMenuInlineKeyboard(role);
      case MenuContext.PROFILE:
        return this.createProfileInlineKeyboard(role);
      case MenuContext.USERS:
        return this.createUsersInlineKeyboard(role);
      case MenuContext.USER_DETAILS:
        return this.createUserDetailsInlineKeyboard(role, params);
      case MenuContext.APPLICATIONS:
        return this.createApplicationsInlineKeyboard(role);
      case MenuContext.APPLICATION_DETAILS:
        return this.createApplicationDetailsInlineKeyboard(role, params);
      case MenuContext.ADMIN_PANEL:
        return this.createAdminPanelInlineKeyboard();
      case MenuContext.ADMIN_USERS:
        return this.createAdminUsersInlineKeyboard();
      case MenuContext.ADMIN_APPS:
        return this.createAdminApplicationsInlineKeyboard();
      case MenuContext.ADMIN_STATS:
        return this.createAdminStatsInlineKeyboard();
      case MenuContext.HELP:
        return this.createHelpInlineKeyboard(role);
      default:
        return this.createMainMenuInlineKeyboard(role);
    }
  }

  /**
   * Создание клавиатуры для главного меню в зависимости от роли
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  private createMainMenuKeyboard(role: UserRole): Keyboard {
    switch (role) {
      case UserRole.NEW:
        return new Keyboard()
          .text("🚪 Подать заявку").text("❓ Помощь")
          .resized()
          .persistent();
      case UserRole.GUEST:
        return new Keyboard()
          .text("📋 Проверить статус").text("❓ Помощь")
          .row()
          .text("👤 Профиль")
          .resized()
          .persistent();
      case UserRole.MEMBER:
        return new Keyboard()
          .text("📋 Проверить статус").text("👥 Заявки")
          .row()
          .text("👤 Профиль").text("❓ Помощь")
          .resized()
          .persistent();
      case UserRole.ADMIN:
        return new Keyboard()
          .text("👥 Заявки").text("👤 Пользователи")
          .row()
          .text("📊 Статистика").text("🔄 Проверить соединение")
          .row()
          .text("⚙️ Настройки").text("🔙 Основное меню")
          .resized()
          .persistent();
      default:
        return new Keyboard()
          .text("🚪 Подать заявку").text("❓ Помощь")
          .resized()
          .persistent();
    }
  }

  /**
   * Создание инлайн-клавиатуры для главного меню в зависимости от роли
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  private createMainMenuInlineKeyboard(role: UserRole): InlineKeyboard {
    switch (role) {
      case UserRole.NEW:
        return new InlineKeyboard()
          .text("Подать заявку", "apply")
          .row()
          .text("Помощь", "help");
      case UserRole.GUEST:
        return new InlineKeyboard()
          .text("Проверить статус", "status")
          .row()
          .text("Профиль", "profile")
          .row()
          .text("Помощь", "help");
      case UserRole.MEMBER:
        return new InlineKeyboard()
          .text("Проверить статус", "status")
          .text("Заявки", "applications")
          .row()
          .text("Профиль", "profile")
          .text("Помощь", "help");
      case UserRole.ADMIN:
        return new InlineKeyboard()
          .text("Заявки", "admin_applications")
          .text("Пользователи", "admin_users")
          .row()
          .text("Статистика", "admin_stats")
          .text("Проверить соединение", "admin_test")
          .row()
          .text("Настройки", "admin");
      default:
        return new InlineKeyboard()
          .text("Подать заявку", "apply")
          .row()
          .text("Помощь", "help");
    }
  }

  /**
   * Создание клавиатуры для профиля
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  private createProfileKeyboard(role: UserRole): Keyboard {
    const keyboard = new Keyboard();
    
    // Базовые опции профиля для всех ролей
    keyboard.text("👤 Мой профиль").text("🔙 Назад");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание инлайн-клавиатуры для профиля
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  private createProfileInlineKeyboard(role: UserRole): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Основные функции профиля
    keyboard.text("📋 История заявок", "profile_applications").row();
    
    // Для участников и администраторов - история голосования и репутация
    if (role === UserRole.MEMBER || role === UserRole.ADMIN) {
      keyboard.text("🗳️ История голосований", "profile_votes").row();
      keyboard.text("📊 Моя репутация", "profile_reputation").row();
    }
    
    // Навигация
    keyboard.text("🔙 Назад", "back").text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание клавиатуры для списка пользователей
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  private createUsersKeyboard(role: UserRole): Keyboard {
    const keyboard = new Keyboard();
    
    // Кнопки зависят от роли
    if (role === UserRole.ADMIN) {
      keyboard.text("👥 Все пользователи").text("🔍 Поиск");
      keyboard.row();
      keyboard.text("👑 Администраторы").text("👤 Участники");
    } else {
      keyboard.text("👥 Участники").text("🔍 Поиск");
    }
    
    keyboard.row();
    keyboard.text("🔙 Назад").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание инлайн-клавиатуры для списка пользователей
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  private createUsersInlineKeyboard(role: UserRole): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Основные функции списка пользователей
    if (role === UserRole.ADMIN) {
      keyboard.text("👥 Все пользователи", "users_all")
        .text("🔍 Поиск пользователя", "users_search").row();
        
      keyboard.text("👑 Администраторы", "users_admins")
        .text("👤 Участники", "users_members").row();
    } else {
      keyboard.text("👥 Все участники", "users_members")
        .text("🔍 Поиск пользователя", "users_search").row();
    }
    
    // Навигация
    keyboard.text("🔙 Назад", "back").text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для деталей пользователя
   * @param role - Роль пользователя
   * @param userId - ID пользователя
   * @returns Инлайн-клавиатура
   */
  private createUserDetailsInlineKeyboard(role: UserRole, params?: any): InlineKeyboard {
    const userId = params?.userId || 0;
    const keyboard = new InlineKeyboard();
    
    // Для участников и администраторов - голосование
    if (role === UserRole.MEMBER || role === UserRole.ADMIN) {
      keyboard.text("👍 Положительный голос", `vote_pos:${userId}`)
        .text("👎 Отрицательный голос", `vote_neg:${userId}`).row();
    }
    
    // Для администраторов - дополнительные функции
    if (role === UserRole.ADMIN) {
      keyboard.text("🔄 Изменить роль", `change_role:${userId}`).row();
      keyboard.text("❌ Заблокировать", `block_user:${userId}`).row();
    }
    
    // Навигация
    keyboard.text("🔙 К списку пользователей", "users_all").row();
    keyboard.text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание клавиатуры для списка заявок
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  private createApplicationsKeyboard(role: UserRole): Keyboard {
    const keyboard = new Keyboard();
    
    // Кнопки зависят от роли
    if (role === UserRole.ADMIN) {
      keyboard.text("📋 Все заявки").text("⏳ Активные заявки");
    } else {
      keyboard.text("📋 Активные заявки");
    }
    
    keyboard.row();
    keyboard.text("🔙 Назад").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание инлайн-клавиатуры для списка заявок
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  private createApplicationsInlineKeyboard(role: UserRole): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Основные функции списка заявок
    if (role === UserRole.ADMIN) {
      keyboard.text("📋 Все заявки", "applications_all")
        .text("⏳ На рассмотрении", "applications_pending").row();
      keyboard.text("✅ Одобренные", "applications_approved")
        .text("❌ Отклоненные", "applications_rejected").row();
    } else {
      keyboard.text("📋 Активные заявки", "applications_pending").row();
    }
    
    // Навигация
    keyboard.text("🔙 Назад", "back").text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для деталей заявки
   * @param role - Роль пользователя
   * @param applicationId - ID заявки
   * @returns Инлайн-клавиатура
   */
  private createApplicationDetailsInlineKeyboard(role: UserRole, params?: any): InlineKeyboard {
    const appId = params?.applicationId || 0;
    const keyboard = new InlineKeyboard();
    
    // Для участников и администраторов - голосование
    if (role === UserRole.MEMBER) {
      keyboard.text("👍 За", `app_vote_yes:${appId}`)
        .text("👎 Против", `app_vote_no:${appId}`).row();
    }
    
    // Для администраторов - дополнительные функции
    if (role === UserRole.ADMIN) {
      keyboard.text("✅ Одобрить", `app_approve:${appId}`)
        .text("❌ Отклонить", `app_reject:${appId}`).row();
    }
    
    // Навигация
    keyboard.text("🔙 К заявкам", "applications_all").row();
    keyboard.text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для панели администратора
   * @returns Инлайн-клавиатура
   */
  private createAdminPanelInlineKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("👥 Управление пользователями", "admin_users")
      .row()
      .text("📋 Управление заявками", "admin_apps")
      .row()
      .text("📊 Статистика", "admin_stats")
      .row()
      .text("◀️ Назад", "back")
      .text("🏠 Главное меню", "main_menu");
  }

  /**
   * Создание инлайн-клавиатуры для панели администратора пользователей
   * @returns Инлайн-клавиатура
   */
  private createAdminUsersInlineKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    keyboard.text("👥 Все пользователи", "admin_users_all")
      .row()
      .text("🔄 По ролям", "admin_users_roles")
      .row()
      .text("🔍 Поиск пользователя", "admin_users_search")
      .row()
      .text("◀️ Назад", "back")
      .text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для панели администратора заявок
   * @returns Инлайн-клавиатура
   */
  private createAdminApplicationsInlineKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    keyboard.text("📋 Активные заявки", "admin_apps_active")
      .row()
      .text("✅ Одобренные", "admin_apps_approved")
      .row()
      .text("❌ Отклоненные", "admin_apps_rejected")
      .row()
      .text("📊 Все заявки", "admin_apps_all")
      .row()
      .text("◀️ Назад", "back")
      .text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для панели статистики администратора
   * @returns Инлайн-клавиатура
   */
  private createAdminStatsInlineKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    keyboard.text("👥 Статистика пользователей", "admin_stats_users")
      .row()
      .text("📋 Статистика заявок", "admin_stats_apps")
      .row()
      .text("📈 Статистика голосований", "admin_stats_votes")
      .row()
      .text("🔄 Обновить статистику", "admin_stats_refresh")
      .row()
      .text("◀️ Назад", "back")
      .text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание инлайн-клавиатуры для справки
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  private createHelpInlineKeyboard(role: UserRole): InlineKeyboard {
    const keyboard = new InlineKeyboard()
      .text("📃 Общая информация", "help_general")
      .row()
      .text("🔄 Процесс вступления", "help_application")
      .row();
    
    if (role === UserRole.MEMBER || role === UserRole.ADMIN) {
      keyboard
        .text("📊 Система репутации", "help_reputation")
        .row()
        .text("📝 Голосование", "help_voting")
        .row();
    }
    
    if (role === UserRole.ADMIN) {
      keyboard
        .text("⚙️ Админ функции", "help_admin")
        .row();
    }
    
    keyboard
      .text("◀️ Назад", "back")
      .text("🏠 Главное меню", "main_menu");
    
    return keyboard;
  }

  /**
   * Создание простой инлайн-клавиатуры для возврата в главное меню
   * @returns Инлайн-клавиатура
   */
  private createBackToMainMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text("🏠 Главное меню", "main_menu");
  }

  /**
   * Создание клавиатуры для деталей пользователя
   * @param role - Роль пользователя
   * @param userId - ID пользователя
   * @returns Клавиатура
   */
  private createUserDetailsKeyboard(role: UserRole, userId: number): Keyboard {
    const keyboard = new Keyboard();
    
    // Для администраторов - дополнительные функции
    if (role === UserRole.ADMIN) {
      keyboard.text("📊 Статистика пользователя").text("⚙️ Управление").row();
      keyboard.text("🔙 К списку пользователей");
    } else {
      keyboard.text("🔙 К списку пользователей");
    }
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание клавиатуры для деталей заявки
   * @param role - Роль пользователя
   * @param applicationId - ID заявки
   * @returns Клавиатура
   */
  private createApplicationDetailsKeyboard(role: UserRole, applicationId: number): Keyboard {
    const keyboard = new Keyboard();
    
    // Для участников и администраторов - дополнительные функции
    if (role === UserRole.MEMBER || role === UserRole.ADMIN) {
      keyboard.text("👍 Голосовать за").text("👎 Голосовать против").row();
      keyboard.text("❓ Задать вопрос");
    }
    
    // Для администраторов - дополнительные функции
    if (role === UserRole.ADMIN) {
      keyboard.row();
      keyboard.text("✅ Одобрить").text("❌ Отклонить").row();
      keyboard.text("🚫 Заблокировать");
    }
    
    keyboard.row();
    keyboard.text("🔙 К заявкам").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание клавиатуры для панели администратора
   * @returns Клавиатура
   */
  private createAdminPanelKeyboard(): Keyboard {
    return new Keyboard()
      .text("👥 Заявки").text("👤 Пользователи")
      .row()
      .text("📊 Статистика").text("🔄 Проверить соединение")
      .row()
      .text("⚙️ Настройки").text("🏠 Основное меню")
      .resized()
      .persistent();
  }

  /**
   * Создание клавиатуры для панели администратора пользователей
   * @returns Клавиатура
   */
  private createAdminUsersKeyboard(): Keyboard {
    const keyboard = new Keyboard();
    
    keyboard.text("👥 Список пользователей").text("🔍 Поиск").row();
    keyboard.text("👑 Администраторы").text("👤 Участники").row();
    keyboard.text("📊 Статистика").row();
    keyboard.text("🔙 В панель администратора").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание клавиатуры для панели администратора заявок
   * @returns Клавиатура
   */
  private createAdminApplicationsKeyboard(): Keyboard {
    const keyboard = new Keyboard();
    
    keyboard.text("📋 Все заявки").text("⏳ На рассмотрении").row();
    keyboard.text("✅ Одобренные").text("❌ Отклоненные").row();
    keyboard.text("📊 Статистика").row();
    keyboard.text("🔙 В панель администратора").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание клавиатуры для панели статистики администратора
   * @returns Клавиатура
   */
  private createAdminStatsKeyboard(): Keyboard {
    const keyboard = new Keyboard();
    
    keyboard.text("🔄 Обновить").row();
    keyboard.text("🔙 В панель администратора").text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание клавиатуры для справки
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  private createHelpKeyboard(role: UserRole): Keyboard {
    const keyboard = new Keyboard();
    
    // Кнопки справки для всех ролей
    keyboard.text("📃 Общая информация")
      .row()
      .text("🔄 Процесс вступления")
      .row();
    
    // Для зарегистрированных пользователей и администраторов
    if (role === UserRole.MEMBER || role === UserRole.ADMIN) {
      keyboard.text("📊 Система репутации")
        .row()
        .text("📝 Голосование")
        .row();
    }
    
    // Навигация
    keyboard.text("🏠 Главное меню");
    
    return keyboard.resized().persistent();
  }

  /**
   * Создание базовой клавиатуры по умолчанию
   * @returns Клавиатура
   */
  private createDefaultKeyboard(): Keyboard {
    const keyboard = new Keyboard()
      .text("🏠 Главное меню");
    
    return keyboard.resized();
  }
} 