import { initDatabase, closeDatabase } from './db/connection';
import { runMigrations } from './db/migrations';
import { logger } from './utils/logger';
import { UserRepository } from './db/repositories/userRepository';
import { UserRole } from './models/types';
import { bot, initBot, setupBotCommands } from './bot';
import { setupRoutes } from './routes';
import { initStateMiddleware } from './middleware/stateMiddleware';
import { userExistsMiddleware, adminRequiredMiddleware } from './middleware/authMiddleware';
import { VotingService } from './services/votingService';
import { ratingService } from './services/ratingService';
import { setBotInstance as setAppControllerBotInstance } from './controllers/applicationController';

// Определение типа оценки, используется в models/sessionTypes.ts
export enum RatingType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative'
}

// Инициализируем сервис голосования
const votingService = new VotingService(bot);

// Передаем экземпляр бота в сервис рейтингов
ratingService.setBotInstance(bot);

// Устанавливаем экземпляр бота в контроллер заявок
setAppControllerBotInstance(bot);
    
// Функция для проверки и создания аккаунта администратора, если его нет
async function ensureAdminAccount(): Promise<void> {
  try {
    const userRepository = new UserRepository();
    
    // Проверяем наличие администратора в системе
    const adminUser = await userRepository.findByTelegramId(parseInt(process.env.ADMIN_TELEGRAM_ID || '0'));
    
    if (!adminUser) {
      // Если администратора нет, создаем его из переменных окружения
      const adminTelegramId = parseInt(process.env.ADMIN_TELEGRAM_ID || '0');
      
      if (adminTelegramId <= 0) {
        throw new Error("ADMIN_TELEGRAM_ID не установлен или некорректен");
  }
      
      // Создаем запись администратора с базовыми полями
      const newAdmin = await userRepository.create({
        telegramId: adminTelegramId,
        username: process.env.ADMIN_USERNAME || 'admin',
        minecraftNickname: process.env.ADMIN_MINECRAFT_NICKNAME || 'admin',
        role: UserRole.ADMIN,
        canVote: true
      });
    
      // Затем обновляем дополнительные поля
      await userRepository.update(newAdmin.id, {
        reputation: 0,
        totalRatingsGiven: 0
      });
      
      logger.info(`✅ Аккаунт администратора создан для Telegram ID: ${adminTelegramId}`);
    } else {
      logger.info('✅ Аккаунт администратора уже существует');
    }
  } catch (error) {
    logger.error('❌ Ошибка при проверке/создании аккаунта администратора:', error);
  }
}

// Функция запуска бота
async function startBot() {
  try {
    // Инициализируем подключение к базе данных
    await initDatabase();
    
    // Запускаем миграции
    await runMigrations();
    
    // Создаем или обновляем аккаунт администратора
    await ensureAdminAccount();
    
    // Инициализируем бота и middleware
    await initBot();
    
    // Добавляем middleware для инициализации state
    bot.use(initStateMiddleware);
    
    // Добавляем middleware для проверки пользователей
    bot.use(userExistsMiddleware);
    bot.use(adminRequiredMiddleware);
    
    // Настраиваем маршрутизацию
    setupRoutes(bot);
    
    // Устанавливаем команды бота
    await setupBotCommands();
    
    // Запускаем бота
    await bot.start({
      onStart: (botInfo) => {
        logger.info(`✅ Бот ${botInfo.username} успешно запущен`);
      },
    });
  } catch (error) {
    logger.error('❌ Ошибка при запуске бота:', error);
    // Закрываем соединение с базой данных при ошибке
    await closeDatabase();
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', async () => {
  logger.info('Получен сигнал SIGINT, завершаем работу...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Получен сигнал SIGTERM, завершаем работу...');
  await closeDatabase();
  process.exit(0);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Необработанное отклонение промиса:', reason);
});

// Запускаем бота
startBot();