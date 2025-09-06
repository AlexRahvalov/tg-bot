import { Bot, Context, session, GrammyError, HttpError, InlineKeyboard } from 'grammy';
import type { SessionFlavor } from 'grammy';
import config from './config/env';
import { initializeDatabase, closeDatabase, executeQuery } from './db/connection';
import { stopCacheCleanup } from './utils/cache';
import { runMigrations } from './db/migrations';
import { applicationController, setBotInstance } from './controllers/applicationController';
import { botController } from './controllers/botController';
import { adminController } from './controllers/adminController';
import { VotingService } from './services/votingService';
import { logger } from './utils/logger';
import { UserRepository } from './db/repositories/userRepository';
import { UserRole, ApplicationStatus, WhitelistStatus } from './models/types';
import { RoleManager } from './components/roles';
import { ratingService } from './services/ratingService';
import { MinecraftService } from './services/minecraftService';
import { ProfileService } from './services/profileService';
import { formatDate } from './utils/stringUtils';
import { ApplicationRepository } from './db/repositories/applicationRepository';
import { profileController } from './controllers/profileController';
import { ratingController } from './controllers/ratingController';

// Енам для типа оценки
export enum RatingType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative'
}

// Расширяем интерфейс SessionData для поддержки состояния оценки
interface SessionData {
  applyState?: {
    step: string;
    minecraftNickname?: string;
    discordUsername?: string;
  };
  ratingState?: {
    targetUserId: number;
    ratingType: RatingType;
    step: string;
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
  // Добавляем поля для процесса оценки пользователей
  step?: string;
  // Добавляем поле для хранения данных формы заявки
  form?: {
    minecraftNickname?: string;
    reason?: string;
    [key: string]: any;
  };
}

// Расширяем тип контекста для использования сессии
export type MyContext = Context & SessionFlavor<SessionData>;

// Создаем экземпляр бота
const bot = new Bot<MyContext>(config.botToken);

// Инициализируем сервис голосования
const votingService = new VotingService(bot);

// Передаем экземпляр бота в сервис рейтингов
ratingService.setBotInstance(bot);

// Устанавливаем экземпляр бота в контроллер заявок
setBotInstance(bot);

// =====================================================
// ВАЖНО: Регистрация обработчиков команд НАПРЯМУЮ к боту
// =====================================================
bot.command("profile", async (ctx) => {
  try {
    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя");
      return;
    }
    
    const telegramId = ctx.from.id;
    logger.info(`Получена команда /profile от пользователя ${telegramId}`);
    
    // Запрашиваем данные пользователя
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе. Используйте /apply для подачи заявки.");
      return;
    }
    
    // Получаем данные о рейтинге
    const ratingsDetails = await ratingService.getUserRatingsDetails(user.id);
    
    // Получаем информацию о последних заявках пользователя
    const applicationRepository = new ApplicationRepository();
    const applications = await applicationRepository.findAllApplicationsByUserId(user.id);
    let applicationStatus = '';
    
    if (applications && applications.length > 0) {
      // Берем самую последнюю заявку
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
    
    // Рассчитываем репутацию
    const reputationScore = user.reputation;
    
    // Форматируем дату
    const createdAtDate = new Date(user.createdAt);
    const joinDate = formatDate(createdAtDate);
    
    // Формируем красивое сообщение с профилем
    let message = `📊 *Ваш профиль:*\n\n`;
    
    // Информация о пользователе
    message += `👤 Telegram: @${user.username ? user.username.replace(/_/g, '\\_') : `user_${telegramId}`}\n`;
    message += `🎮 Minecraft: ${user.minecraftNickname.replace(/_/g, '\\_')}\n`;
    message += `📅 Дата вступления: ${joinDate}`;
    
    // Добавляем информацию о заявке, если она есть
    if (applicationStatus) {
      message += applicationStatus;
    }
    
    // Статистика рейтинга
    message += `\n\n*Статистика рейтинга:*\n`;
    message += `⭐️ Репутация: ${reputationScore}\n`;
    message += `👍 Положительные оценки: ${ratingsDetails.positiveCount}\n`;
    message += `👎 Отрицательные оценки: ${ratingsDetails.negativeCount}\n`;
    message += `📊 Всего получено оценок: ${ratingsDetails.positiveCount + ratingsDetails.negativeCount}\n`;
    message += `✍️ Выдано оценок: ${user.totalRatingsGiven || 0}\n`;
    
    // Отправляем сообщение
    await ctx.reply(message, { parse_mode: "Markdown" });
    
  } catch (error) {
    logger.error("🔴 Критическая ошибка в команде /profile:", error);
    try {
      await ctx.reply("❌ Произошла ошибка. Попробуйте позже.");
    } catch (replyError) {
      logger.error("Не удалось отправить сообщение об ошибке:", replyError);
    }
  }
});

bot.command("viewprofile", async (ctx) => {
  try {
    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя");
      return;
    }
    
    logger.info(`Получена команда /viewprofile от пользователя ${ctx.from.id}`);
    
    // Получаем список всех пользователей через репозиторий
    const userRepository = new UserRepository();
    const members = await userRepository.findAllMembers();
    
    if (!members || members.length === 0) {
      await ctx.reply("👥 Активных участников не найдено.");
      return;
    }
    
    // Создаем клавиатуру для выбора пользователя
    const keyboard = new InlineKeyboard();
    
    // Добавляем по 2 пользователя в ряд
    for (let i = 0; i < members.length; i += 2) {
      const firstMember = members[i];
      const secondMember = i + 1 < members.length ? members[i + 1] : null;
      
      if (firstMember) {
        keyboard.text(firstMember.minecraftNickname, `view_profile_${firstMember.id}`);
      }
      
      if (secondMember) {
        keyboard.text(secondMember.minecraftNickname, `view_profile_${secondMember.id}`);
      }
      
      keyboard.row();
    }
    
    await ctx.reply("👥 Выберите пользователя для просмотра профиля:", { reply_markup: keyboard });
    
  } catch (error) {
    logger.error("Ошибка в команде /viewprofile:", error);
    await ctx.reply("❌ Произошла ошибка при получении списка пользователей.");
  }
});

// Обработчик команды /members перенесен в ratingController

// =====================================================
// Конец прямой регистрации обработчиков
// =====================================================

// Добавляем middleware для работы с сессиями
bot.use(session({
  initial: (): SessionData => ({})
}));

// Регистрируем обработчики команд основного функционала
// ВАЖНО: ratingController должен быть ПЕРЕД adminController,
// чтобы select_member_ обрабатывался без adminMiddleware
bot.use(botController);
bot.use(applicationController);
bot.use(profileController);
bot.use(ratingController);
bot.use(adminController);

// Только после регистрации всех прямых команд добавляем 
// перехватчик для отладки (чтобы он не блокировал выполнение команд)
bot.use(async (ctx, next) => {
  let updateType = 'unknown';
  if (ctx.message) updateType = 'message';
  else if (ctx.callbackQuery) updateType = 'callback_query';
  else if (ctx.inlineQuery) updateType = 'inline_query';
  
  const message = ctx.message?.text;
  logger.info(`🔍 Получено обновление типа: ${updateType}, текст: ${message || 'нет'}`);
  
  await next();
});

// Обработчик колбэка для просмотра профиля
bot.callbackQuery(/^view_profile_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя по ID
    const userRepository = new UserRepository();
    const user = await userRepository.findById(targetUserId);
    
    if (!user) {
      await ctx.reply("⚠️ Пользователь не найден.");
      return;
    }
    
    // Получаем детальную информацию о рейтинге
    const ratingsDetails = await ratingService.getUserRatingsDetails(targetUserId);
    
    const roleName = {
      [RoleManager.ROLES.ADMIN]: 'Администратор',
      [RoleManager.ROLES.MEMBER]: 'Участник',
      [RoleManager.ROLES.APPLICANT]: 'Заявитель',
      [RoleManager.ROLES.VISITOR]: 'Посетитель'
    }[user.role];
    
    let message = `👤 *Профиль пользователя*\n\n` +
                 `*Никнейм:* ${user.minecraftNickname}\n` +
                 `*Роль:* ${roleName}\n` +
                 `*Репутация:* ${user.reputation > 0 ? '👍 ' : ''}${user.reputation < 0 ? '👎 ' : ''}${user.reputation}\n` +
                 `*Положительных оценок:* ${ratingsDetails.positiveCount}\n` +
                 `*Отрицательных оценок:* ${ratingsDetails.negativeCount}\n` +
                 `*Дата регистрации:* ${user.createdAt.toLocaleDateString()}\n`;
    
    // Создаем клавиатуру для оценки участника
    const keyboard = new InlineKeyboard()
      .text("👍 Респект", `rate_positive_${user.id}`)
      .text("👎 Жалоба", `rate_negative_${user.id}`);
    
    await ctx.reply(message, { 
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Ошибка при просмотре профиля:', error);
    await ctx.reply('❌ Произошла ошибка при просмотре профиля');
  }
});

// Обработчики для оценки пользователей
// Обработчик оценок удален - теперь используется ratingController

// Обработчик отмены оценки удален - теперь используется ratingController

// Обработчик возврата к списку участников
// Обработчик return_to_members перенесен в ratingController

// Обработчик сообщений для завершения процесса оценки
// Обработчик текстовых сообщений удален - теперь используется ratingController

// Обработчик выбора участника удален - теперь используется ratingController

// Обработчик для показа истории оценок
bot.callbackQuery(/^show_ratings_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя по ID
    const userRepository = new UserRepository();
    const targetUser = await userRepository.findById(targetUserId);
    
    if (!targetUser) {
      await ctx.reply("⚠️ Пользователь не найден.");
      return;
    }
    
    // Получаем данные о рейтинге
    const ratingsDetails = await ratingService.getUserRatingsDetails(targetUserId);
    
    // Создаем клавиатуру для возврата к профилю
    const keyboard = new InlineKeyboard()
      .text("« Назад к профилю", `select_member_${targetUserId}`)
      .row()
      .text("« Назад к списку", "return_to_members");
    
    // Формируем сообщение с информацией о рейтинге
    let message = `📊 *Информация о рейтинге пользователя ${targetUser.minecraftNickname}:*\n\n`;
    message += `👍 Положительных оценок: ${ratingsDetails.positiveCount}\n`;
    message += `👎 Отрицательных оценок: ${ratingsDetails.negativeCount}\n`;
    message += `⭐️ Репутация: ${targetUser.reputation}\n\n`;
    
    // Напоминание о возможности оценки
    message += `Чтобы оценить пользователя, вернитесь к его профилю и нажмите кнопку "Положительная оценка" или "Отрицательная оценка".`;
    
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Ошибка при получении информации о рейтинге:', error);
    await ctx.reply('❌ Произошла ошибка при получении информации о рейтинге');
  }
});

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
// Переменная для хранения интервала проверки истекших голосований
let expiredVotingsInterval: NodeJS.Timeout | null = null;

async function startBot() {
  try {
    // Инициализируем подключение к базе данных
    await initializeDatabase();
    
    // Запускаем миграции
    await runMigrations();
    
    // Создаем или обновляем аккаунт администратора
    await ensureAdminAccount();
    
    // Синхронизируем whitelist с одобренными пользователями
    await syncWhitelistOnStartup();
    
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
    
    // Запускаем периодическую проверку истекших голосований
    startExpiredVotingsCheck();
    
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

/**
 * Запуск периодической проверки истекших голосований
 */
function startExpiredVotingsCheck(): void {
  if (expiredVotingsInterval) {
    return; // Уже запущен
  }
  
  // Проверяем истекшие голосования каждые 5 минут
  expiredVotingsInterval = setInterval(async () => {
    try {
      const processedCount = await votingService.checkExpiredVotings();
      if (processedCount > 0) {
        logger.info(`✅ Обработано ${processedCount} истекших голосований`);
      }
    } catch (error) {
      logger.error('❌ Ошибка при проверке истекших голосований:', error);
    }
  }, 5 * 60 * 1000); // 5 минут
  
  logger.info('✅ Автоматическая проверка истекших голосований запущена');
}

/**
 * Остановка периодической проверки истекших голосований
 */
function stopExpiredVotingsCheck(): void {
  if (expiredVotingsInterval) {
    clearInterval(expiredVotingsInterval);
    expiredVotingsInterval = null;
    logger.info('🛑 Автоматическая проверка истекших голосований остановлена');
  }
}

// Запускаем бота
startBot();

// Синхронизация whitelist с одобренными пользователями при запуске
async function syncWhitelistOnStartup() {
  try {
    logger.info('🔄 Начинаем синхронизацию whitelist...');
    
    const userRepository = new UserRepository();
    const minecraftService = new MinecraftService();
    
    // Добавляем отладочную информацию
    logger.info('🔍 Выполняем запрос для поиска пользователей со статусом not_added...');
    
    // Получаем только пользователей со статусом 'not_added'
    const usersToAdd = await userRepository.findUsersNotInWhitelist();
    
    logger.info(`🔍 Результат запроса: найдено ${usersToAdd.length} пользователей`);
    if (usersToAdd.length > 0) {
      logger.info('👥 Найденные пользователи:', usersToAdd.map(u => ({ id: u.id, username: u.username, role: u.role, minecraftNickname: u.minecraftNickname, minecraftUUID: u.minecraftUUID })));
    }
    
    if (usersToAdd.length === 0) {
      logger.info('ℹ️ Нет пользователей со статусом not_added для синхронизации whitelist');
      return;
    }
    
    logger.info(`📋 Найдено ${usersToAdd.length} пользователей со статусом not_added для синхронизации`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Получаем текущий список whitelist с сервера для проверки
    const whitelistedPlayers = await minecraftService.getWhitelistedPlayers();
    
    for (const user of usersToAdd) {
      try {
        if (user.minecraftUUID) {
          // Проверяем, есть ли пользователь уже в whitelist
          const isInWhitelist = whitelistedPlayers && whitelistedPlayers.some(player => 
            player.toLowerCase() === user.minecraftNickname.toLowerCase()
          );
          
          if (isInWhitelist) {
            // Пользователь уже в whitelist, обновляем статус
             logger.info(`Пользователь ${user.minecraftNickname} уже в whitelist, обновляем статус`);
             await userRepository.updateWhitelistStatus(user.id, WhitelistStatus.ADDED);
            successCount++;
          } else {
            // Пользователя нет в whitelist, добавляем
            const result = await minecraftService.addToWhitelist(user.minecraftNickname, user.minecraftUUID, user.id);
            if (result) {
              successCount++;
              logger.info(`✅ Пользователь ${user.minecraftNickname} добавлен в whitelist`);
            } else {
              failureCount++;
              logger.warn(`⚠️ Не удалось добавить ${user.minecraftNickname} в whitelist`);
            }
          }
        } else {
          logger.warn(`⚠️ У пользователя ${user.minecraftNickname} отсутствует UUID`);
          failureCount++;
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failureCount++;
        logger.error(`❌ Ошибка при добавлении ${user.minecraftNickname} в whitelist:`, error);
      }
    }
    
    logger.info(`🏁 Синхронизация завершена: ${successCount} успешно, ${failureCount} с ошибками`);
    
    // Проверяем и повторно добавляем пользователей со статусом not_added
    logger.info('🔄 Запускаем проверку пользователей со статусом not_added...');
    await minecraftService.retryFailedWhitelistAdditions();
    
  } catch (error) {
    logger.error('❌ Ошибка при синхронизации whitelist:', error);
  }
}

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
        role: RoleManager.ROLES.ADMIN,
        canVote: true
      });
      logger.info(`✅ Создан аккаунт администратора (Telegram ID: ${adminTelegramId})`);
    } else if (!RoleManager.isAdmin(adminUser)) {
      // Обновляем права, если аккаунт существует, но не имеет прав администратора
      adminUser = await userRepository.update(adminUser.id, {
        role: RoleManager.ROLES.ADMIN,
        canVote: true
      });
      logger.info(`✅ Обновлены права администратора (Telegram ID: ${adminTelegramId})`);
    }
  } catch (error) {
    logger.error('❌ Ошибка при создании аккаунта администратора:', error);
  }
}

// Обработка сигналов завершения для корректного закрытия соединений
// Обработка сигналов завершения приложения
process.once('SIGINT', async () => {
  logger.info('🛑 Получен сигнал SIGINT, завершаем приложение...');
  stopCacheCleanup();
  stopExpiredVotingsCheck();
  await closeDatabase();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  logger.info('🛑 Получен сигнал SIGTERM, завершаем приложение...');
  stopCacheCleanup();
  stopExpiredVotingsCheck();
  await closeDatabase();
  process.exit(0);
});