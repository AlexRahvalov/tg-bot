import { Bot, Context, session, GrammyError, HttpError } from 'grammy';
import type { SessionFlavor } from 'grammy';
import config from './config/env';
import { initDatabase, closeDatabase } from './db/connection';
import { runMigrations } from './db/migrations';
import { applicationController } from './controllers/applicationController';
import { botController } from './controllers/botController';
import { adminController } from './controllers/adminController';
import { ratingController } from './controllers/ratingController';
import { VotingService } from './services/votingService';
import { logger } from './utils/logger';
import { UserRepository } from './db/repositories/userRepository';
import { UserRole } from './models/types';

// Определяем интерфейс для данных сессии
interface SessionData {
  step?: string;
  form?: {
    minecraftNickname?: string;
    reason?: string;
  };
  applicationId?: number;
  questionId?: number;
  targetUserId?: number;
  votingSettings?: {
    days: number;
    hours: number;
    minutes: number;
  };
  minVotesRequired?: number;
  negativeThreshold?: number;
}

// Расширяем тип контекста, включая в него сессию
export type MyContext = Context & SessionFlavor<SessionData>;

console.log('🤖 Запуск Telegram-бота для Minecraft-сервера...');

// Инициализируем бота с токеном из конфигурации
const bot = new Bot<MyContext>(config.botToken);

// Хранилище сессий в памяти
const sessionMap = new Map<string, SessionData>();

// Настраиваем хранилище сессий
bot.use(session({
  initial: (): SessionData => ({}),
  storage: {
    read: async (key) => {
      return sessionMap.get(key) || {};
    },
    write: async (key, value) => {
      sessionMap.set(key, value);
    },
    delete: async (key) => {
      sessionMap.delete(key);
    }
  }
}));

// Подключаем контроллеры
bot.use(botController);
bot.use(applicationController);
bot.use(adminController);
bot.use(ratingController);

// Обработка ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`, err.error);
  
  if (err.error instanceof GrammyError) {
    logger.error('Ошибка в запросе к Telegram API:', err.error);
  } else if (err.error instanceof HttpError) {
    logger.error('Ошибка при соединении с Telegram API:', err.error);
  } else {
    logger.error('Неизвестная ошибка:', err.error);
  }
});

// Создание или обновление аккаунта администратора
async function ensureAdminAccount() {
  try {
    const adminTelegramId = parseInt(config.adminTelegramId);
    
    if (!adminTelegramId || isNaN(adminTelegramId)) {
      logger.warn('⚠️ ID администратора не указан в конфигурации или недействителен');
    return;
  }
  
    const userRepository = new UserRepository();
    let adminUser = await userRepository.findByTelegramId(adminTelegramId);
    
    if (!adminUser) {
      // Создаем аккаунт администратора, если он не существует
      adminUser = await userRepository.create({
        telegramId: adminTelegramId,
        username: 'admin',
        minecraftNickname: 'admin',
        role: UserRole.ADMIN,
        canVote: true
      });
      logger.info(`✅ Создан аккаунт администратора (Telegram ID: ${adminTelegramId})`);
    } else if (adminUser.role !== UserRole.ADMIN) {
      // Обновляем права, если аккаунт существует, но не имеет прав администратора
      adminUser = await userRepository.update(adminUser.id, {
        role: UserRole.ADMIN,
        canVote: true
      });
      logger.info(`✅ Обновлены права администратора (Telegram ID: ${adminTelegramId})`);
    }
  } catch (error) {
    logger.error('❌ Ошибка при создании аккаунта администратора:', error);
  }
}

// Запуск бота
async function startBot() {
  try {
    // Инициализируем подключение к базе данных
    await initDatabase();
    
    // Запускаем миграции
    await runMigrations();
    
    // Создаем аккаунт администратора
    await ensureAdminAccount();
    
    // Запуск бота
    await bot.start({
      onStart: (botInfo) => {
        logger.info(`✅ Бот @${botInfo.username} успешно запущен`);
      },
    });
    
    // Запускаем сервис проверки истекших голосований
    const votingService = new VotingService(bot);
    const checkVotingsInterval = setInterval(async () => {
      try {
        const processedCount = await votingService.checkExpiredVotings();
        if (processedCount > 0) {
          logger.info(`✅ Обработано ${processedCount} истекших голосований`);
        }
      } catch (error) {
        logger.error("❌ Ошибка при проверке истекших голосований:", error);
      }
    }, 60000); // Проверяем каждую минуту
    
    // Обработка сигналов остановки приложения
    process.once('SIGINT', async () => {
      logger.info('🛑 Получен сигнал SIGINT, останавливаем бота...');
      clearInterval(checkVotingsInterval);
      await bot.stop();
      await closeDatabase();
      logger.info('✅ Бот и база данных остановлены');
    });
    
    process.once('SIGTERM', async () => {
      logger.info('🛑 Получен сигнал SIGTERM, останавливаем бота...');
      clearInterval(checkVotingsInterval);
      await bot.stop();
      await closeDatabase();
      logger.info('✅ Бот и база данных остановлены');
    });
  } catch (error) {
    logger.error('❌ Ошибка при запуске бота:', error);
    await closeDatabase();
    process.exit(1);
  }
}

// Запускаем бота
startBot().catch((error) => {
  logger.error('Критическая ошибка при запуске бота:', error);
  process.exit(1);
}); 