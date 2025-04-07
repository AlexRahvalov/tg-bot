import { Bot, Context, session, GrammyError, HttpError } from 'grammy';
import type { SessionFlavor } from 'grammy';
import config from './config/env';
import { initDatabase, closeDatabase } from './db/connection';
import { runMigrations } from './db/migrations';
import { applicationController, setBotInstance } from './controllers/applicationController';
import { botController } from './controllers/botController';
import { adminController } from './controllers/adminController';
import { ratingController } from './controllers/ratingController';
import { profileController } from './controllers/profileController';
import { VotingService } from './services/votingService';
import { logger } from './utils/logger';
import { UserRepository } from './db/repositories/userRepository';
import { UserRole, ApplicationStatus } from './models/types';
import { ratingService } from './services/ratingService';
import { ProfileService } from './services/profileService';
import { formatDate } from './utils/stringUtils';
import { ApplicationRepository } from './db/repositories/applicationRepository';

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
  askQuestionAppId?: number;
}

// Расширяем тип контекста для использования сессии
export type MyContext = Context & SessionFlavor<SessionData>;

// Создаем экземпляр бота
const bot = new Bot<MyContext>(config.botToken);

// Инициализируем сервис голосования
const votingService = new VotingService(bot);

// Устанавливаем экземпляр бота в контроллер заявок
setBotInstance(bot);

// Добавляем middleware для работы с сессиями
bot.use(session({
  initial: (): SessionData => ({})
}));

// Добавляем перехватчик всех обновлений для отладки
bot.use(async (ctx, next) => {
  let updateType = 'unknown';
  if (ctx.message) updateType = 'message';
  else if (ctx.callbackQuery) updateType = 'callback_query';
  else if (ctx.inlineQuery) updateType = 'inline_query';
  
  const message = ctx.message?.text;
  logger.info(`🔍 Получено обновление типа: ${updateType}, текст: ${message || 'нет'}`);
  
  await next();
});

// Прямая регистрация команды /profile с передачей в controller
bot.command('profile', async (ctx) => {
  logger.info('🔄 Получена команда /profile в глобальном обработчике - перенаправление в контроллер');
  // Создаем экземпляр ProfileService только для этого вызова
  const profileService = new ProfileService();
  const userRepository = new UserRepository();
  const applicationRepository = new ApplicationRepository();
  
  try {
    if (!ctx.from) {
      logger.error('Пользователь не определен в контексте');
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }
    
    const telegramId = ctx.from.id;
    logger.info(`Запрос профиля для пользователя с Telegram ID: ${telegramId}`);

    // Проверяем, зарегистрирован ли пользователь
    const user = await userRepository.findByTelegramId(telegramId);
    
    // Безопасное логирование объекта пользователя
    if (user) {
      logger.info('Пользователь найден в базе данных');
      logger.info(`Имя пользователя: ${user.username}, роль: ${user.role}`);
    } else {
      logger.info('Пользователь не найден в базе данных');
    }
    
    if (!user) {
      await ctx.reply('❌ Вы не зарегистрированы в системе. Пожалуйста, подайте заявку на вступление командой /apply');
      return;
    }
    
    // Получаем профиль пользователя
    const profile = await profileService.getProfile(telegramId);
    
    // Безопасное логирование
    if (profile) {
      logger.info('Профиль пользователя найден');
      logger.info(`Никнейм: ${profile.nickname}, Minecraft: ${profile.minecraft_username || 'не указан'}`);
    } else {
      logger.info('Профиль пользователя не найден');
    }
    
    if (!profile) {
      await ctx.reply('❌ Профиль не найден. Возможно, вы еще не являетесь участником сообщества.');
      return;
    }

    // Получаем историю оценок
    const ratingHistory = await profileService.getRatingHistory(profile.user_id);
    
    const reputationScore = profile.positive_ratings_received - profile.negative_ratings_received;

    // Получаем последние заявки пользователя (если есть)
    // Сначала получаем ID пользователя из профиля
    const userId = profile.user_id;
    const applications = await applicationRepository.findAllApplicationsByUserId(userId);
    let applicationStatus = '';
    
    if (applications && applications.length > 0) {
      // Берем самую последнюю заявку (первую в массиве)
      const latestApp = applications[0];
      // Добавляем информацию о статусе заявки (если она в активном состоянии)
      if (latestApp && latestApp.status === ApplicationStatus.PENDING) {
        applicationStatus = '\n📝 *У вас есть активная заявка на рассмотрении*';
      } else if (latestApp && latestApp.status === ApplicationStatus.VOTING) {
        applicationStatus = '\n🗳️ *Ваша заявка находится в процессе голосования*';
      } else if (latestApp && latestApp.status === ApplicationStatus.REJECTED) {
        applicationStatus = '\n❌ *Ваша последняя заявка была отклонена*';
      }
    }
    
    // Формируем сообщение с информацией о профиле
    let message = `📊 *Ваш профиль:*\n\n`;
    message += `👤 Telegram: @${user.username ? user.username.replace(/_/g, '\\_') : 'неизвестно'}\n`;
    if (profile.minecraft_username) {
      message += `🎮 Minecraft: ${profile.minecraft_username.replace(/_/g, '\\_')}\n`;
    }
    message += `📅 Дата вступления: ${formatDate(profile.join_date)}`;
    
    // Добавляем информацию о заявке, если она есть
    if (applicationStatus) {
      message += applicationStatus;
    }
    
    message += `\n\n*Статистика рейтинга:*\n`;
    message += `⭐️ Репутация: ${reputationScore}\n`;
    message += `👍 Положительные оценки: ${profile.positive_ratings_received}\n`;
    message += `👎 Отрицательные оценки: ${profile.negative_ratings_received}\n`;
    message += `📊 Всего получено оценок: ${profile.total_ratings_received}\n`;
    message += `✍️ Выдано оценок: ${profile.total_ratings_given}\n\n`;

    // Добавляем последние оценки, если они есть
    if (ratingHistory && ratingHistory.length > 0) {
      message += `*Последние оценки:*\n`;
      ratingHistory.slice(0, 5).forEach(rating => {
        const icon = rating.isPositive ? '👍' : '👎';
        message += `${icon} от ${rating.raterNickname}`;
        if (rating.reason) {
          message += `: ${rating.reason}`;
        }
        message += '\n';
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
    logger.info('Сообщение с профилем успешно отправлено');
  } catch (error) {
    logger.error('Ошибка в обработке команды /profile:', error);
    console.error('Подробная ошибка:', error);
    await ctx.reply('❌ Произошла ошибка при получении профиля');
  }
});

// Регистрируем обработчики команд
bot.use(botController);
bot.use(applicationController);
bot.use(adminController);
bot.use(profileController); // Регистрируем контроллер профиля
bot.use(ratingController);

// Обработка ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    logger.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    logger.error("Could not contact Telegram:", e);
  } else {
    logger.error("Unknown error:", e);
  }
});

// Функция запуска бота
async function startBot() {
  try {
    // Инициализируем подключение к базе данных
    await initDatabase();
    
    // Запускаем миграции
    await runMigrations();
    
    // Создаем или обновляем аккаунт администратора
    await ensureAdminAccount();
    
    // Устанавливаем команды бота
    await bot.api.setMyCommands([
      { command: "start", description: "Начать работу с ботом" },
      { command: "help", description: "Показать список команд" },
      { command: "apply", description: "Подать заявку на вступление" },
      { command: "status", description: "Проверить статус заявки" },
      { command: "profile", description: "Посмотреть свой профиль" },
      { command: "viewprofile", description: "Посмотреть профили других участников" },
      { command: "members", description: "Показать список участников" },
    ]);
    
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

// Запускаем бота
startBot();

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

// Обработка сигналов завершения для корректного закрытия соединений
process.once('SIGINT', () => closeDatabase());
process.once('SIGTERM', () => closeDatabase()); 