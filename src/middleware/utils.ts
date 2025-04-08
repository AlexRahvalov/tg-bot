import { BUTTON_LABELS } from '../constants';
import { UserRepository } from '../db/repositories/userRepository';
import type { MyContext } from '../models/sessionTypes';
import type { User } from '../models/types';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';

// Создаем экземпляр репозитория
const userRepository = new UserRepository();

/**
 * Проверяет, является ли текст командой базового взаимодействия
 * @param text Текст сообщения для проверки
 * @returns true, если это базовая команда
 */
export function isBasicCommand(text?: string): boolean {
  if (!text) return false;
  
  return [
    '/start', 
    '/help', 
    '/apply', 
    '/status',
    BUTTON_LABELS.SUBMIT_APPLICATION,
    BUTTON_LABELS.HELP,
    BUTTON_LABELS.SERVER_INFO,
    BUTTON_LABELS.CHECK_STATUS
  ].includes(text);
}

/**
 * Проверяет, является ли колбэк связанным с заявками
 * @param data Данные колбэка для проверки
 * @returns true, если колбэк связан с заявками
 */
export function isApplicationCallback(data?: string): boolean {
  if (!data) return false;
  
  return [
    'confirm_application',
    'cancel_application',
    'back_to_main',
    'show_application_',
    'start_application'
  ].some(prefix => data.startsWith(prefix));
}

/**
 * Проверяет, является ли текст командой администратора
 * @param text Текст сообщения для проверки
 * @returns true, если это команда администратора
 */
export function isAdminCommand(text?: string): boolean {
  if (!text) return false;
  
  return [
    '/admin',
    BUTTON_LABELS.ADMIN_PANEL
  ].includes(text);
}

/**
 * Проверяет, является ли колбэк связанным с администрированием
 * @param data Данные колбэка для проверки
 * @returns true, если колбэк связан с администрированием
 */
export function isAdminCallback(data?: string): boolean {
  if (!data) return false;
  
  return data.startsWith('admin_');
}

/**
 * Проверяет, является ли текст командой для участников
 * @param text Текст сообщения для проверки
 * @returns true, если это команда для участников
 */
export function isMemberCommand(text?: string): boolean {
  if (!text) return false;
  
  return [
    '/members',
    '/viewprofile',
    BUTTON_LABELS.MEMBERS,
    BUTTON_LABELS.ACTIVE_APPLICATIONS
  ].includes(text);
}

/**
 * Проверяет, является ли колбэк связанным с функциями участников
 * @param data Данные колбэка для проверки
 * @returns true, если колбэк связан с функциями участников
 */
export function isMemberCallback(data?: string): boolean {
  if (!data) return false;
  
  return data.startsWith('view_profile_') || data.startsWith('rate_');
}

/**
 * Получает пользователя из контекста или базы данных
 * @param ctx Контекст сообщения
 * @returns Объект пользователя или null
 */
export async function getUserFromContext(ctx: MyContext): Promise<User | null> {
  if (!ctx.from) {
    return null;
  }
  
  // Используем пользователя из контекста, если он уже проверен
  if (ctx.state?.user) {
    return ctx.state.user;
  }
  
  try {
    // Иначе получаем из базы данных
    return await userRepository.findByTelegramId(ctx.from.id);
  } catch (error) {
    logger.error('Ошибка при получении пользователя из базы данных:', error);
    return null;
  }
}

/**
 * Проверяет, имеет ли пользователь права администратора
 * @param user Объект пользователя
 * @returns true, если пользователь администратор
 */
export function isAdmin(user: User | null): boolean {
  return !!user && user.role === UserRole.ADMIN;
}

/**
 * Проверяет, имеет ли пользователь права участника или администратора
 * @param user Объект пользователя
 * @returns true, если пользователь участник или администратор
 */
export function isMember(user: User | null): boolean {
  return !!user && (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN);
}

/**
 * Получает и проверяет пользователя из контекста
 * @param ctx Контекст сообщения
 * @param sendError Отправлять ли сообщение об ошибке
 * @returns Объект пользователя или null в случае ошибки
 */
export async function ensureUser(ctx: MyContext, sendError: boolean = true): Promise<User | null> {
  if (!ctx.from) {
    if (sendError) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя.");
    }
    return null;
  }
  
  const user = await getUserFromContext(ctx);
  
  if (!user && sendError) {
    await ctx.reply(
      '⚠️ Вы не зарегистрированы в системе.\n\n' +
      'Для начала работы используйте команду /start и подайте заявку с помощью команды /apply.'
    );
  }
  
  return user;
} 