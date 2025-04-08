import type { MyContext } from '../models/sessionTypes';
import { logger } from '../utils/logger';

/**
 * Middleware для сбора метрик производительности
 * Логирует время выполнения обработчиков и тип запроса
 */
export const metricsMiddleware = async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
  const startTime = Date.now();
  
  // Сохраняем тип обновления для метрик
  let updateType = 'unknown';
  if (ctx.message) updateType = 'message';
  else if (ctx.callbackQuery) updateType = 'callback_query';
  else if (ctx.inlineQuery) updateType = 'inline_query';
  
  // Подробная информация о запросе (только в режиме отладки)
  if (process.env.NODE_ENV === 'development') {
    const messageText = ctx.message?.text || (ctx.callbackQuery?.data ? `callback: ${ctx.callbackQuery.data}` : 'нет');
    logger.debug(`📥 Входящий запрос: ${updateType}, текст: ${messageText}`);
  }
  
  await next();
  
  const processingTime = Date.now() - startTime;
  
  // Логируем метрики
  logger.debug(`⏱️ Метрики: тип=${updateType}, время=${processingTime}ms`);
  
  // Если обработка заняла слишком много времени, логируем предупреждение
  if (processingTime > 1000) {
    logger.warn(`⚠️ Долгое выполнение запроса: ${updateType}, время=${processingTime}ms`);
  }
}; 