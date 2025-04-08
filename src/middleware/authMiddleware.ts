import type { MyContext } from '../models/sessionTypes';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';
import { withMiddlewareErrorHandling } from '../utils/errorHandler';
import { isBasicCommand, isApplicationCallback, isAdminCommand, isAdminCallback, isMemberCommand, isMemberCallback } from './utils';

// Репозиторий пользователей для проверки
const userRepository = new UserRepository();

/**
 * Middleware для проверки существования пользователя
 * Проверяет, зарегистрирован ли пользователь в системе
 */
export const userExistsMiddleware = withMiddlewareErrorHandling(
  async (ctx: MyContext, next: () => Promise<void>) => {
    // Если сообщение уже обработано другим контроллером
    if (ctx.session?.__processed) {
      return await next();
    }

    // Если это вызов базовой команды, пропускаем проверку
    if (ctx.message?.text && isBasicCommand(ctx.message.text)) {
      return await next();
    }

    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя.");
      return;
    }

    const telegramId = ctx.from.id;
    const user = await userRepository.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(
        '⚠️ Вы не зарегистрированы в системе.\n\n' +
        'Для начала работы используйте команду /start и подайте заявку с помощью команды /apply.'
      );
      return;
    }

    // Добавляем пользователя в контекст для дальнейшего использования
    ctx.state = ctx.state || {};
    ctx.state.user = user;

    await next();
  },
  'проверка существования пользователя'
);

/**
 * Middleware для проверки прав администратора
 * Проверяет, имеет ли пользователь права администратора
 */
export const adminRequiredMiddleware = withMiddlewareErrorHandling(
  async (ctx: MyContext, next: () => Promise<void>) => {
    // Если сообщение уже обработано другим контроллером
    if (ctx.session?.__processed) {
      return await next();
    }
    
    // Пропускаем основные команды и обработчики для всех пользователей
    if (ctx.message?.text && isBasicCommand(ctx.message.text)) {
      return await next();
    }
    
    // Пропускаем обработку кнопок заявок
    if (ctx.callbackQuery?.data && isApplicationCallback(ctx.callbackQuery.data)) {
      return await next();
    }
    
    // Если команда непосредственно для админ-панели, проверяем права
    if ((ctx.message?.text && isAdminCommand(ctx.message.text)) || 
        (ctx.callbackQuery?.data && isAdminCallback(ctx.callbackQuery.data))) {
      
      if (!ctx.from) {
        return await ctx.reply("⚠️ Не удалось определить пользователя.");
      }
      
      // Используем пользователя из контекста, если он уже проверен userExistsMiddleware
      let user = ctx.state?.user;
      
      if (!user) {
        const foundUser = await userRepository.findByTelegramId(ctx.from.id);
        if (foundUser) {
          user = foundUser;
        }
      }
      
      if (!user || user.role !== UserRole.ADMIN) {
        return await ctx.reply("⚠️ У вас нет прав доступа к этой функции.");
      }
    }
    
    await next();
  },
  'проверка прав администратора'
);

/**
 * Middleware для проверки прав участника
 * Проверяет, имеет ли пользователь права участника или администратора
 */
export const memberRequiredMiddleware = withMiddlewareErrorHandling(
  async (ctx: MyContext, next: () => Promise<void>) => {
    // Если сообщение уже обработано другим контроллером
    if (ctx.session?.__processed) {
      return await next();
    }
    
    // Пропускаем основные команды для всех пользователей
    if (ctx.message?.text && isBasicCommand(ctx.message.text)) {
      return await next();
    }
    
    // Для команд, требующих роли участника, проверяем права
    if ((ctx.message?.text && isMemberCommand(ctx.message.text)) || 
        (ctx.callbackQuery?.data && isMemberCallback(ctx.callbackQuery.data))) {
      
      if (!ctx.from) {
        return await ctx.reply("⚠️ Не удалось определить пользователя.");
      }
      
      // Используем пользователя из контекста, если он уже проверен userExistsMiddleware
      let user = ctx.state?.user;
      
      if (!user) {
        const foundUser = await userRepository.findByTelegramId(ctx.from.id);
        if (foundUser) {
          user = foundUser;
        }
      }
      
      if (!user || (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN)) {
        return await ctx.reply(
          "⚠️ Эта функция доступна только для участников сервера.\n\n" +
          "Чтобы стать участником, подайте заявку с помощью команды /apply."
        );
      }
    }
    
    await next();
  },
  'проверка прав участника'
); 