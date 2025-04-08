import { Bot, session } from 'grammy';
import type { MyContext, SessionData } from './models/sessionTypes';
import config from './config/env';
import { logger } from './utils/logger';

// Создаем и экспортируем экземпляр бота
export const bot = new Bot<MyContext>(config.botToken);

// Middleware для логирования обновлений
export const loggingMiddleware = async (ctx: MyContext, next: () => Promise<void>) => {
  let updateType = 'unknown';
  if (ctx.message) updateType = 'message';
  else if (ctx.callbackQuery) updateType = 'callback_query';
  else if (ctx.inlineQuery) updateType = 'inline_query';
  
  const message = ctx.message?.text;
  logger.info(`🔍 Получено обновление типа: ${updateType}, текст: ${message || 'нет'}`);
  
  const startTime = Date.now();
  await next();
  const ms = Date.now() - startTime;
  logger.debug(`Запрос обработан за ${ms}ms`);
};

// Настраиваем обработку ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof Error) {
    logger.error(e.message);
    logger.debug(e.stack);
  } else {
    logger.error(e);
  }
});

// Инициализация бота
export async function initBot() {
  // Добавляем middleware для сессий
  bot.use(session({
    initial: (): SessionData => ({})
  }));
  
  // Добавляем middleware для логирования
  bot.use(loggingMiddleware);
  
  return bot;
}

// Функция установки команд бота
export async function setupBotCommands() {
  await bot.api.setMyCommands([
    { command: "start", description: "Начать работу с ботом" },
    { command: "help", description: "Показать список команд" },
    { command: "apply", description: "Подать заявку на вступление" },
    { command: "status", description: "Проверить статус заявки" },
    { command: "profile", description: "Посмотреть свой профиль" },
    { command: "viewprofile", description: "Посмотреть профили других участников" },
    { command: "members", description: "Показать список участников" },
  ]);
} 