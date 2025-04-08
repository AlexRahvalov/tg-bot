import { Bot, Context, session, GrammyError, HttpError, InlineKeyboard } from 'grammy';
import type { SessionFlavor } from 'grammy';
import config from './config/env';
import { initDatabase, closeDatabase, executeQuery } from './db/connection';
import { runMigrations } from './db/migrations';
import { applicationController, setBotInstance } from './controllers/applicationController';
import { botController } from './controllers/botController';
import { adminController } from './controllers/adminController';
import { VotingService } from './services/votingService';
import { logger } from './utils/logger';
import { UserRepository } from './db/repositories/userRepository';
import { UserRole, ApplicationStatus } from './models/types';
import { ratingService } from './services/ratingService';
import { ProfileService } from './services/profileService';
import { formatDate } from './utils/stringUtils';
import { ApplicationRepository } from './db/repositories/applicationRepository';
import { profileController } from './controllers/profileController';

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

bot.command("members", async (ctx) => {
  try {
    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя");
      return;
    }
    
    logger.info(`Получена команда /members от пользователя ${ctx.from.id}`);
    
    // Проверяем права пользователя
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе. Используйте /apply для подачи заявки.");
      return;
    }
    
    // Только члены и администраторы могут оценивать других участников
    if (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN) {
      await ctx.reply("⚠️ Только участники и администраторы могут просматривать и оценивать других участников.");
      return;
    }
    
    // Получаем список всех участников
    try {
      const members = await userRepository.findAllMembers();
      
      if (!members || members.length === 0) {
        await ctx.reply("👥 В системе пока нет активных участников с ролью MEMBER или ADMIN. Пожалуйста, попробуйте позже.");
        return;
      }
      
      // Создаем клавиатуру для выбора пользователя
      const keyboard = new InlineKeyboard();
      
      // Добавляем по 2 пользователя в ряд
      for (let i = 0; i < members.length; i += 2) {
        const firstMember = members[i];
        const secondMember = i + 1 < members.length ? members[i + 1] : null;
        
        if (firstMember) {
          // Используем имя пользователя Telegram, если есть, иначе имя Minecraft
          const displayName = firstMember.username ? `@${firstMember.username}` : firstMember.minecraftNickname;
          
          // Добавляем индикатор репутации
          const reputationIndicator = firstMember.reputation > 0 ? '⭐️' : 
                                     firstMember.reputation < 0 ? '⚠️' : '➖';
          
          keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${firstMember.id}`);
        }
        
        if (secondMember) {
          const displayName = secondMember.username ? `@${secondMember.username}` : secondMember.minecraftNickname;
          const reputationIndicator = secondMember.reputation > 0 ? '⭐️' : 
                                     secondMember.reputation < 0 ? '⚠️' : '➖';
          
          keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${secondMember.id}`);
        }
        
        keyboard.row();
      }
      
      await ctx.reply("📊 *Список участников для оценки*\n\nВыберите пользователя, чтобы поставить ему оценку:", {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error("Ошибка при получении списка участников:", error);
      await ctx.reply("❌ Произошла ошибка при получении списка участников. Пожалуйста, попробуйте позже.");
    }
  } catch (error) {
    logger.error("Ошибка в команде /members:", error);
    await ctx.reply("❌ Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.");
  }
});

// =====================================================
// Конец прямой регистрации обработчиков
// =====================================================

// Добавляем middleware для работы с сессиями
bot.use(session({
  initial: (): SessionData => ({})
}));

// Регистрируем обработчики команд основного функционала
bot.use(botController);
bot.use(applicationController);
bot.use(adminController);
bot.use(profileController);
// Не регистрируем ratingController, чтобы избежать конфликтов

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
      [UserRole.ADMIN]: 'Администратор',
      [UserRole.MEMBER]: 'Участник',
      [UserRole.APPLICANT]: 'Заявитель'
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
bot.callbackQuery(/^rate_(positive|negative)_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Получаем информацию о пользователе, который совершает оценку
    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать отправителя.");
      return;
    }
    
    const fromUserTelegramId = ctx.from.id.toString();
    const userRepository = new UserRepository();
    
    // Находим пользователя, который ставит оценку
    // Преобразуем строку в число
    const numericTelegramId = parseInt(fromUserTelegramId);
    const fromUser = await userRepository.findByTelegramId(numericTelegramId);
    
    if (!fromUser) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
      return;
    }
    
    // Проверяем, может ли пользователь голосовать
    if (fromUser.role !== UserRole.MEMBER && fromUser.role !== UserRole.ADMIN) {
      await ctx.reply("⚠️ Только участники и администраторы могут ставить оценки.");
      return;
    }
    
    // Получаем тип оценки и ID целевого пользователя
    const ratingType = ctx.match[1] === 'positive' ? RatingType.POSITIVE : RatingType.NEGATIVE;
    const targetUserId = parseInt(ctx.match[2] || '0');
    
    // Проверяем, что пользователь не оценивает сам себя
    if (fromUser.id === targetUserId) {
      await ctx.reply("⚠️ Вы не можете оценить сами себя.");
      return;
    }
    
    // Находим целевого пользователя
    const targetUser = await userRepository.findById(targetUserId);
    
    if (!targetUser) {
      await ctx.reply("⚠️ Целевой пользователь не найден.");
      return;
    }
    
    // Сохраняем информацию в сессии
    ctx.session.ratingState = {
      targetUserId: targetUserId,
      ratingType: ratingType,
      step: 'awaiting_reason'
    };
    
    // Создаем клавиатуру для отмены
    const keyboard = new InlineKeyboard()
      .text("❌ Отменить", "cancel_rating");
    
    // Запрашиваем причину оценки
    const prompt = ratingType === RatingType.POSITIVE
      ? "👍 Пожалуйста, укажите причину положительной оценки:"
      : "👎 Пожалуйста, укажите причину отрицательной оценки:";
    
    await ctx.reply(prompt, { reply_markup: keyboard });
    
  } catch (error) {
    logger.error('Ошибка при обработке запроса на оценку:', error);
    await ctx.reply('❌ Произошла ошибка при обработке запроса на оценку');
  }
});

// Обработчик отмены оценки
bot.callbackQuery("cancel_rating", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Сбрасываем состояние оценки
    ctx.session.ratingState = undefined;
    
    await ctx.reply("✅ Оценка отменена.");
    
    // Возвращаемся к списку пользователей
    const keyboard = new InlineKeyboard()
      .text("👥 Вернуться к списку пользователей", "return_to_members");
    
    await ctx.reply("Что вы хотите сделать дальше?", { reply_markup: keyboard });
    
  } catch (error) {
    logger.error('Ошибка при отмене оценки:', error);
    await ctx.reply('❌ Произошла ошибка при отмене оценки');
  }
});

// Обработчик возврата к списку участников
bot.callbackQuery("return_to_members", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    logger.info("Запрос на возврат к списку участников");
    
    if (!ctx.from) {
      await ctx.reply("⚠️ Не удалось идентифицировать пользователя");
      return;
    }
    
    // Получаем список всех участников
    const userRepository = new UserRepository();
    const members = await userRepository.findAllMembers();
    
    logger.info(`Получено ${members ? members.length : 0} участников`);
    
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
        // Используем имя пользователя Telegram, если есть, иначе имя Minecraft
        const displayName = firstMember.username ? `@${firstMember.username}` : firstMember.minecraftNickname;
        
        // Добавляем индикатор репутации
        const reputationIndicator = firstMember.reputation > 0 ? '⭐️' : 
                                   firstMember.reputation < 0 ? '⚠️' : '➖';
        
        keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${firstMember.id}`);
      }
      
      if (secondMember) {
        const displayName = secondMember.username ? `@${secondMember.username}` : secondMember.minecraftNickname;
        const reputationIndicator = secondMember.reputation > 0 ? '⭐️' : 
                                   secondMember.reputation < 0 ? '⚠️' : '➖';
        
        keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${secondMember.id}`);
      }
      
      keyboard.row();
    }
    
    logger.info("Отправляем сообщение со списком участников");
    await ctx.editMessageText("📊 *Список участников для оценки*\n\nВыберите пользователя, чтобы поставить ему оценку:", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    logger.info("Сообщение со списком участников успешно отправлено");
    
  } catch (error) {
    logger.error('Ошибка при возврате к списку участников:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка участников.');
  }
});

// Обработчик сообщений для завершения процесса оценки
bot.on("message:text", async (ctx) => {
  try {
    // Проверяем, находится ли пользователь в процессе оценки
    if (ctx.session.ratingState && ctx.session.ratingState.step === 'awaiting_reason') {
      // Получаем информацию о пользователе
      if (!ctx.from) {
        await ctx.reply("⚠️ Не удалось идентифицировать отправителя.");
        return;
      }
      
      const fromUserTelegramId = ctx.from.id.toString();
      const userRepository = new UserRepository();
      
      // Находим пользователя, который ставит оценку
      // Преобразуем строку в число
      const numericTelegramId = parseInt(fromUserTelegramId);
      const fromUser = await userRepository.findByTelegramId(numericTelegramId);
      
      if (!fromUser) {
        await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
        ctx.session.ratingState = undefined;
        return;
      }
      
      // Получаем данные из сессии
      const targetUserId = ctx.session.ratingState.targetUserId;
      const ratingType = ctx.session.ratingState.ratingType;
      const reason = ctx.message.text;
      
      if (!reason || reason.trim().length < 5) {
        await ctx.reply("⚠️ Причина должна содержать не менее 5 символов.");
        return;
      }
      
      // Создаем рейтинг с преобразованием типа
      const isPositive = ratingType === RatingType.POSITIVE;
      await ratingService.addRating(fromUser.id, targetUserId, isPositive, reason);
      
      // Сбрасываем состояние
      ctx.session.ratingState = undefined;
      
      // Отправляем сообщение об успешной оценке
      const successMessage = ratingType === RatingType.POSITIVE
        ? "👍 Вы успешно поставили положительную оценку."
        : "👎 Вы успешно поставили отрицательную оценку.";
      
      await ctx.reply(successMessage);
      
      // Создаем клавиатуру для возврата к просмотру профиля
      const keyboard = new InlineKeyboard()
        .text("👤 Просмотреть обновленный профиль", `view_profile_${targetUserId}`)
        .row()
        .text("👥 Вернуться к списку участников", "return_to_members");
      
      await ctx.reply("Что вы хотите сделать дальше?", { reply_markup: keyboard });
    }
  } catch (error) {
    logger.error('Ошибка при обработке причины оценки:', error);
    await ctx.reply('❌ Произошла ошибка при обработке причины оценки');
    ctx.session.ratingState = undefined;
  }
});

// Обработчик выбора участника из списка
bot.callbackQuery(/^select_member_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    logger.info(`Выбран пользователь с ID: ${targetUserId}`);
    
    // Получаем пользователя по ID
    const userRepository = new UserRepository();
    const targetUser = await userRepository.findById(targetUserId);
    
    if (!targetUser) {
      logger.warn(`Пользователь с ID ${targetUserId} не найден`);
      await ctx.reply("⚠️ Пользователь не найден.");
      return;
    }
    
    logger.info(`Найден пользователь: id=${targetUser.id}, username=${targetUser.username}, minecraft=${targetUser.minecraftNickname}`);
    
    // Получаем детальную информацию о рейтинге
    logger.info(`Запрашиваем информацию о рейтинге для пользователя с ID: ${targetUserId}`);
    const ratingsDetails = await ratingService.getUserRatingsDetails(targetUserId);
    logger.info(`Получена информация о рейтинге: позитивных=${ratingsDetails.positiveCount}, негативных=${ratingsDetails.negativeCount}`);
    
    // Формируем имя пользователя для отображения
    const displayName = targetUser.username ? `@${targetUser.username}` : targetUser.minecraftNickname;
    
    // Создаем сообщение с информацией о пользователе
    let message = `👤 *Информация о пользователе:*\n\n`;
    
    if (targetUser.username) {
      message += `*Telegram:* @${targetUser.username.replace(/_/g, '\\_')}\n`;
    }
    
    message += `*Minecraft:* ${targetUser.minecraftNickname}\n`;
    message += `*Репутация:* ${targetUser.reputation} `;
    
    // Добавляем индикатор репутации
    if (targetUser.reputation > 0) {
      message += "👍";
    } else if (targetUser.reputation < 0) {
      message += "👎";
    }
    
    message += `\n*Положительных оценок:* ${ratingsDetails.positiveCount}\n`;
    message += `*Отрицательных оценок:* ${ratingsDetails.negativeCount}\n\n`;
    message += `*Выберите действие:*`;
    
    // Создаем клавиатуру для действий с пользователем
    const keyboard = new InlineKeyboard()
      .text("👍 Положительная оценка", `rate_positive_${targetUser.id}`)
      .row()
      .text("👎 Отрицательная оценка", `rate_negative_${targetUser.id}`)
      .row()
      .text("📊 История оценок", `show_ratings_${targetUser.id}`)
      .row()
      .text("« Назад к списку", "return_to_members");
    
    logger.info("Отправляем сообщение с информацией о пользователе");
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    logger.info("Сообщение с информацией о пользователе успешно отправлено");
    
  } catch (error) {
    logger.error('Ошибка при выборе участника:', error);
    await ctx.reply('❌ Произошла ошибка при выборе участника');
  }
});

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