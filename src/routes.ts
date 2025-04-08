import { Bot } from 'grammy';
import type { MyContext } from './models/sessionTypes';
import { logger } from './utils/logger';
import { userExistsMiddleware } from './middleware/authMiddleware';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { botController } from './controllers/botController';
import { applicationController } from './controllers/applicationController';
import { adminController } from './controllers/adminController';
import { profileController } from './controllers/profileController';
import { ratingController } from './controllers/ratingController';

/**
 * Настройка маршрутизации и middleware
 * @param bot Экземпляр Telegraf бота
 */
export const setupRoutes = (bot: Bot<MyContext>): void => {
  // Middleware для сбора метрик производительности (должен быть первым)
  bot.use(metricsMiddleware);
  logger.info('✅ Middleware метрик зарегистрирован');
  
  // User existence middleware
  bot.use(userExistsMiddleware);
  logger.info('✅ Middleware проверки пользователя зарегистрирован');
  
  // Регистрация контроллеров
  bot.use(botController);
  logger.info('✅ Базовый контроллер зарегистрирован');
  
  bot.use(applicationController);
  logger.info('✅ Контроллер заявок зарегистрирован');
  
  bot.use(profileController);
  logger.info('✅ Контроллер профилей зарегистрирован');
  
  bot.use(adminController);
  logger.info('✅ Админ контроллер зарегистрирован');
  
  bot.use(ratingController);
  logger.info('✅ Контроллер оценок зарегистрирован');
  
  logger.info('✅ Все маршруты успешно зарегистрированы');
}; 