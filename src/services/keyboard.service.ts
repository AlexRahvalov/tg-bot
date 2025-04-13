import { Keyboard, InlineKeyboard } from 'grammy';
import { Bot } from 'grammy';
import { UserRole } from '../models/user.model';
import { KeyboardFactory } from './keyboard.factory';

/**
 * Перечисление контекстов меню
 */
export enum MenuContext {
  MAIN = 'main',                  // Главное меню
  PROFILE = 'profile',            // Профиль пользователя
  USERS = 'users',                // Список пользователей
  USER_DETAILS = 'user_details',  // Детали пользователя
  APPLICATIONS = 'applications',  // Заявки
  APPLICATION_DETAILS = 'application_details', // Детали заявки
  ADMIN_PANEL = 'admin_panel',    // Панель администратора
  ADMIN_USERS = 'admin_users',    // Управление пользователями
  ADMIN_APPS = 'admin_apps',      // Управление заявками
  ADMIN_STATS = 'admin_stats',    // Статистика
  HELP = 'help'                   // Помощь
}

/**
 * Сервис для работы с клавиатурами и командами
 */
export class KeyboardService {
  private bot: Bot;
  private keyboardFactory: KeyboardFactory;

  constructor(bot: Bot) {
    this.bot = bot;
    this.keyboardFactory = new KeyboardFactory();
  }

  /**
   * Получение клавиатуры для нового пользователя
   * @returns Клавиатура для нового пользователя
   */
  getNewUserKeyboard(): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(MenuContext.MAIN, UserRole.NEW);
    return keyboard as Keyboard;
  }

  /**
   * Получение клавиатуры для гостя (подал заявку)
   * @returns Клавиатура для гостя
   */
  getGuestKeyboard(): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(MenuContext.MAIN, UserRole.GUEST);
    return keyboard as Keyboard;
  }

  /**
   * Получение клавиатуры для зарегистрированного пользователя
   * @returns Клавиатура для зарегистрированного пользователя
   */
  getRegisteredUserKeyboard(): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(MenuContext.MAIN, UserRole.MEMBER);
    return keyboard as Keyboard;
  }

  /**
   * Получение клавиатуры для администратора
   * @returns Клавиатура для администратора
   */
  getAdminKeyboard(): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(MenuContext.MAIN, UserRole.ADMIN);
    return keyboard as Keyboard;
  }

  /**
   * Получение стартовой инлайн-клавиатуры для нового пользователя
   * @returns Инлайн-клавиатура для нового пользователя
   */
  getNewUserInlineKeyboard(): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(MenuContext.MAIN, UserRole.NEW);
    return keyboard;
  }

  /**
   * Получение стартовой инлайн-клавиатуры для гостя
   * @returns Инлайн-клавиатура для гостя
   */
  getGuestInlineKeyboard(): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(MenuContext.MAIN, UserRole.GUEST);
    return keyboard;
  }

  /**
   * Получение стартовой инлайн-клавиатуры для зарегистрированного пользователя
   * @returns Инлайн-клавиатура для зарегистрированного пользователя
   */
  getRegisteredUserInlineKeyboard(): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(MenuContext.MAIN, UserRole.MEMBER);
    return keyboard;
  }

  /**
   * Получение инлайн-клавиатуры для администратора
   * @returns Инлайн-клавиатура для администратора
   */
  getAdminInlineKeyboard(): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(MenuContext.MAIN, UserRole.ADMIN);
    return keyboard;
  }

  /**
   * Получение клавиатуры в зависимости от роли пользователя
   * @param role - Роль пользователя
   * @returns Клавиатура
   */
  getKeyboardByRole(role: UserRole): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(MenuContext.MAIN, role);
    return keyboard as Keyboard;
  }

  /**
   * Получение инлайн-клавиатуры в зависимости от роли пользователя
   * @param role - Роль пользователя
   * @returns Инлайн-клавиатура
   */
  getInlineKeyboardByRole(role: UserRole): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(MenuContext.MAIN, role);
    return keyboard;
  }

  /**
   * Управление навигацией между контекстами меню
   * @param ctx - Контекст Telegram
   * @param newContext - Новый контекст меню
   * @param prevContext - Предыдущий контекст (опционально)
   * @param params - Дополнительные параметры для клавиатуры (опционально)
   * @returns Объект с инлайн-клавиатурой и репли-клавиатурой
   */
  async navigateToContext(ctx: any, role: UserRole, newContext: MenuContext, prevContext?: MenuContext, params?: any): Promise<{
    inlineKeyboard: InlineKeyboard;
    replyKeyboard: Keyboard;
    contextTitle: string;
  }> {
    // Получаем инлайн-клавиатуру и обычную клавиатуру для нового контекста
    const inlineKeyboard = this.getInlineKeyboardByContext(role, newContext, params);
    const replyKeyboard = this.getKeyboardByContext(role, newContext);
    
    // Формируем заголовок для контекста
    let contextTitle = this.getContextTitle(newContext);
    
    return {
      inlineKeyboard,
      replyKeyboard,
      contextTitle
    };
  }

  /**
   * Получение заголовка для контекста
   * @param context - Контекст меню
   * @returns Заголовок контекста
   */
  private getContextTitle(context: MenuContext): string {
    switch (context) {
      case MenuContext.MAIN:
        return 'Главное меню';
      case MenuContext.PROFILE:
        return 'Ваш профиль';
      case MenuContext.USERS:
        return 'Список пользователей';
      case MenuContext.USER_DETAILS:
        return 'Детали пользователя';
      case MenuContext.APPLICATIONS:
        return 'Заявки на вступление';
      case MenuContext.APPLICATION_DETAILS:
        return 'Детали заявки';
      case MenuContext.ADMIN_PANEL:
        return 'Панель администратора';
      case MenuContext.ADMIN_USERS:
        return 'Управление пользователями';
      case MenuContext.ADMIN_APPS:
        return 'Управление заявками';
      case MenuContext.ADMIN_STATS:
        return 'Статистика сервера';
      case MenuContext.HELP:
        return 'Помощь и информация';
      default:
        return 'Меню';
    }
  }

  /**
   * Установка команд бота в зависимости от роли пользователя
   * @param telegramId - ID пользователя в Telegram
   * @param role - Роль пользователя
   */
  async setCommands(telegramId: number | bigint, role: UserRole): Promise<void> {
    try {
      const commands = this.getCommandsForRole(role);
      
      // Преобразование telegramId в Number, если это BigInt
      const chatId = typeof telegramId === 'bigint' ? Number(telegramId) : telegramId;
      
      // Установка команд для конкретного пользователя
      await this.bot.api.setMyCommands(commands, {
        scope: { type: 'chat', chat_id: chatId }
      });
      
      console.log(`Установлены команды для пользователя ${chatId} с ролью ${role}`);
    } catch (error) {
      console.error(`Ошибка при установке команд для пользователя ${telegramId}:`, error);
    }
  }

  /**
   * Получение списка команд для указанной роли
   * @param role - Роль пользователя
   * @returns Список команд
   */
  private getCommandsForRole(role: UserRole): Array<{ command: string, description: string }> {
    // Базовые команды доступны всем
    const baseCommands = [
      { command: "start", description: "Начать работу с ботом" },
      { command: "help", description: "Показать справку" },
    ];

    switch (role) {
      case UserRole.NEW:
        baseCommands.push(
          { command: "apply", description: "Подать заявку на вступление" }
        );
        break;

      case UserRole.GUEST:
        baseCommands.push(
          { command: "status", description: "Проверить статус заявки" },
          { command: "profile", description: "Просмотр профиля" }
        );
        break;

      case UserRole.MEMBER:
        baseCommands.push(
          { command: "applications", description: "Просмотр активных заявок" },
          { command: "status", description: "Проверить статус заявки" },
          { command: "profile", description: "Просмотр и редактирование профиля" }
        );
        break;

      case UserRole.ADMIN:
        baseCommands.push(
          { command: "admin", description: "Панель администратора" },
          { command: "admin_applications", description: "Управление заявками" },
          { command: "admin_users", description: "Управление пользователями" },
          { command: "admin_stats", description: "Статистика сервера" },
          { command: "admin_test", description: "Проверить соединение с сервером" }
        );
        break;
    }

    return baseCommands;
  }

  /**
   * Установка глобальных команд бота (видны всем пользователям)
   */
  async setGlobalCommands(): Promise<void> {
    try {
      // Минимальный набор команд
      const globalCommands = [
        { command: "start", description: "Начать работу с ботом" },
        { command: "apply", description: "Подать заявку на вступление" },
        { command: "help", description: "Показать справку" },
      ];

      await this.bot.api.setMyCommands(globalCommands);
      console.log('Установлены глобальные команды бота');
    } catch (error) {
      console.error('Ошибка при установке глобальных команд:', error);
    }
  }

  /**
   * Получение клавиатуры в зависимости от контекста и роли пользователя
   * @param role - Роль пользователя
   * @param context - Контекст меню
   * @returns Клавиатура
   */
  getKeyboardByContext(role: UserRole, context: MenuContext): Keyboard {
    const keyboard = this.keyboardFactory.createKeyboard(context, role);
    return keyboard as Keyboard;
  }

  /**
   * Получение инлайн-клавиатуры в зависимости от контекста и роли пользователя
   * @param role - Роль пользователя
   * @param context - Контекст меню
   * @param params - Дополнительные параметры (опционально)
   * @returns Инлайн-клавиатура
   */
  getInlineKeyboardByContext(role: UserRole, context: MenuContext, params?: any): InlineKeyboard {
    const keyboard = this.keyboardFactory.createInlineKeyboard(context, role, params);
    return keyboard;
  }

  /**
   * Создание простой инлайн-клавиатуры для возврата в главное меню
   * @returns Инлайн-клавиатура
   */
  private getBackToMainMenuKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard().text("🏠 Главное меню", "main_menu");
    return keyboard;
  }
}