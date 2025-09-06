import { UserRepository } from '../db/repositories/userRepository';
import { UserRole, type User } from '../models/types';
import type { MyContext } from '../index';
import { logger } from './logger';

/**
 * Утилиты для работы с пользователями
 */
export class UserUtils {
  private static userRepository = new UserRepository();

  /**
   * Получает пользователя по Telegram ID
   * @param telegramId ID пользователя в Telegram
   * @returns Пользователь или null
   */
  static async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return await this.userRepository.findByTelegramId(telegramId);
  }

  /**
   * Проверяет, является ли пользователь администратором
   * @param user Пользователь
   * @returns true, если пользователь администратор
   */
  static isAdmin(user: User | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  /**
   * Проверяет, является ли пользователь участником или администратором
   * @param user Пользователь
   * @returns true, если пользователь участник или администратор
   */
  static isMemberOrAdmin(user: User | null): boolean {
    return user?.role === UserRole.MEMBER || user?.role === UserRole.ADMIN;
  }

  /**
   * Проверяет, может ли пользователь голосовать
   * @param user Пользователь
   * @returns true, если пользователь может голосовать
   */
  static canVote(user: User | null): boolean {
    return user?.canVote === true && this.isMemberOrAdmin(user);
  }

  /**
   * Получает отображаемое имя пользователя
   * @param user Пользователь
   * @returns Отображаемое имя
   */
  static getDisplayName(user: User): string {
    if (user.username) {
      return `@${user.username}`;
    }
    if (user.minecraftNickname) {
      return user.minecraftNickname;
    }
    return `ID: ${user.telegramId}`;
  }

  /**
   * Централизованная функция для обработки ошибок доступа с логированием
   * @param ctx Контекст
   * @param callerInfo Информация о месте вызова (файл, функция, строка)
   * @param userInfo Информация о пользователе (опционально)
   */
  static async handleAccessDenied(
    ctx: MyContext, 
    callerInfo: string, 
    userInfo?: { telegramId?: number; username?: string; role?: UserRole }
  ): Promise<void> {
    const logMessage = `🚫 Отказ в доступе | Вызов из: ${callerInfo}`;
    const userDetails = userInfo 
      ? ` | Пользователь: ID=${userInfo.telegramId}, username=${userInfo.username || 'N/A'}, role=${userInfo.role || 'N/A'}`
      : ' | Пользователь: не определен';
    
    logger.warn(logMessage + userDetails);
    await ctx.reply('⚠️ У вас нет прав доступа к этой функции.');
  }

  /**
   * Middleware для проверки прав администратора
   * @param ctx Контекст
   * @param next Следующий обработчик
   */
  static async requireAdmin(ctx: MyContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('⚠️ Не удалось определить пользователя.');
      return;
    }

    const user = await this.getUserByTelegramId(ctx.from.id);
    
    if (!this.isAdmin(user)) {
      await this.handleAccessDenied(
        ctx, 
        'UserUtils.requireAdmin', 
        { telegramId: ctx.from.id, username: ctx.from.username, role: user?.role }
      );
      return;
    }
    
    await next();
  }

  /**
   * Middleware для проверки прав участника или администратора
   * @param ctx Контекст
   * @param next Следующий обработчик
   */
  static async requireMemberOrAdmin(ctx: MyContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('⚠️ Не удалось определить пользователя.');
      return;
    }

    const user = await this.getUserByTelegramId(ctx.from.id);
    
    if (!this.isMemberOrAdmin(user)) {
      await this.handleAccessDenied(
        ctx, 
        'UserUtils.requireMemberOrAdmin', 
        { telegramId: ctx.from.id, username: ctx.from.username, role: user?.role }
      );
      return;
    }
    
    await next();
  }

  /**
   * Middleware для проверки прав голосования
   * @param ctx Контекст
   * @param next Следующий обработчик
   */
  static async requireVotingRights(ctx: MyContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('⚠️ Не удалось определить пользователя.');
      return;
    }

    const user = await this.getUserByTelegramId(ctx.from.id);
    
    if (!this.canVote(user)) {
      await ctx.reply('⚠️ У вас нет права голоса.');
      return;
    }
    
    await next();
  }

  /**
   * Получает роль пользователя в виде строки
   * @param role Роль пользователя
   * @returns Строковое представление роли
   */
  static getRoleDisplayName(role: UserRole): string {
    const roleMap = {
      [UserRole.ADMIN]: 'Администратор',
      [UserRole.MEMBER]: 'Участник',
      [UserRole.APPLICANT]: 'Заявитель'
    };
    return roleMap[role] || 'Неизвестная роль';
  }
}