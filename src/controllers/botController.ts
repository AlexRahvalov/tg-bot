import { Composer, Bot, InlineKeyboard } from 'grammy';
import type { MyContext } from '../index';
import { keyboardService } from '../services/keyboardService';
import { handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';
import { messageService } from '../services/messageService';
import { ApplicationRepository } from '../db/repositories/applicationRepository';
import { ProfileService } from '../services/profileService';
import { formatDate } from '../utils/stringUtils';
import config from '../config/env';
import { UserUtils } from '../utils/userUtils';
import { ButtonComponents } from '../components/buttons';

// Создаем репозиторий пользователей для проверки прав
const userRepository = new UserRepository();
const profileService = new ProfileService();

// Создаем композер для основных команд
const botController = new Composer<MyContext>();

// Middleware для обновления данных пользователя
botController.use(async (ctx, next) => {
  try {
    if (!ctx.from) return await next();
    
    const telegramId = ctx.from.id;
    const adminTelegramId = parseInt(config.adminTelegramId);
    
    // Проверяем, является ли пользователь администратором из конфига
    const isConfigAdmin = !isNaN(adminTelegramId) && telegramId === adminTelegramId;
    
    // Получаем текущую информацию о пользователе
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (user) {
      // Обновляем информацию о пользователе, если она изменилась
      const username = ctx.from.username || `user_${telegramId}`;
      
      if (user.username !== username || (isConfigAdmin && user.role !== UserRole.ADMIN)) {
        // Обновляем username и роль, если это администратор из конфига
        await userRepository.update(user.id, {
          username,
          ...(isConfigAdmin ? { role: UserRole.ADMIN, canVote: true } : {})
        });
        
        logger.info(`Обновлена информация о пользователе: ${username} (${telegramId})`);
      }
    }
    
    return await next();
  } catch (error) {
    logger.error('Ошибка при обновлении данных пользователя:', error);
    return await next();
  }
});

// Функции для обработки команд
async function showStartMessage(ctx: MyContext) {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    
    await ctx.reply(
      'Привет! Я бот для доступа к Minecraft-серверу. С моей помощью вы можете подать заявку на вступление.\n\n' +
      'Используйте кнопки ниже или команду /apply для начала процесса подачи заявки.',
      { reply_markup: keyboard }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "showStartMessage");
  }
}

async function showHelpMessage(ctx: MyContext) {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    
    await ctx.reply(
      'Я помогаю управлять доступом к Minecraft-серверу.\n\n' +
      'Доступные команды:\n' +
      '/start - Начать работу с ботом\n' +
      '/apply - Подать заявку на вступление\n' +
      '/status - Проверить статус заявки\n' +
      '/help - Показать справку\n\n' +
      'Для администраторов:\n' +
      '/admin - Панель администратора',
      { reply_markup: keyboard }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "showHelpMessage");
  }
}

async function showServerInfo(ctx: MyContext) {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    
    // Основное сообщение
    const serverInfo = 'Информация о нашем Minecraft-сервере:\n\n' +
      '🏠 IP-адрес: play.example.com\n' +
      '🎮 Версия: 1.20.2\n' +
      '👥 Режим игры: Выживание\n' +
      '👮 Тип доступа: Демократический белый список\n\n' +
      'Чтобы подать заявку на вступление, используйте команду /apply или кнопку "Подать заявку".';
      
    // Отправляем сообщение с клавиатурой
    await ctx.reply(serverInfo, { reply_markup: keyboard });
    
    // Если пользователь админ, отправляем отдельное сообщение с инлайн-кнопкой
    if (ctx.from?.id) {
      try {
        const user = await userRepository.findByTelegramId(ctx.from.id);
        if (user && user.role === UserRole.ADMIN) {
          const adminKeyboard = keyboardService.getAdminPanelKeyboard();
          await ctx.reply("Панель администратора:", { reply_markup: adminKeyboard });
        }
      } catch (error) {
        logger.error("Ошибка при проверке прав администратора:", error);
      }
    }
  } catch (error) {
    await handleErrorWithContext(ctx, error, "showServerInfo");
  }
}

async function showAdminPanel(ctx: MyContext) {
  try {
    if (!ctx.from) return;
    
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user || user.role !== UserRole.ADMIN) {
      const keyboard = await keyboardService.getMainKeyboard(ctx.from.id);
      return await ctx.reply(
        "⚠️ У вас нет прав доступа к этой функции.",
        { reply_markup: keyboard }
      );
    }
    
    const keyboard = keyboardService.getAdminPanelKeyboard();
    
    await ctx.reply(
      "🛠️ Панель администратора\n\n" +
      "Выберите раздел для управления:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "showAdminPanel");
  }
}

// Обработка команд
botController.command("start", async (ctx) => {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(messageService.getStartMessage(), { reply_markup: keyboard });
  } catch (error) {
    logger.error("Ошибка при обработке команды /start:", error);
    await ctx.reply("Произошла ошибка при запуске бота. Пожалуйста, попробуйте позже.");
  }
});

botController.command("help", async (ctx) => {
  try {
    const message = `🤖 Доступные команды:

Основные команды:
/start - Начать работу с ботом
/help - Показать список команд
/apply - Подать заявку на вступление

Профиль и рейтинг:
/profile - Посмотреть свой профиль
/viewprofile - Посмотреть профили других участников
/members - Показать список участников с возможностью оценки

Для администраторов:
/admin - Открыть панель администратора
/update_all_voting_rights - Обновить права голосования для всех участников

Чтобы узнать больше о любой команде, просто введите её.`;
    
    // Отправляем без форматирования Markdown, чтобы избежать ошибок парсинга
    await ctx.reply(message);
  } catch (error) {
    logger.error("Ошибка при обработке команды /help:", error);
  }
});

botController.command("admin", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user || user.role !== UserRole.ADMIN) {
      const keyboard = await keyboardService.getMainKeyboard(ctx.from.id);
      await UserUtils.handleAccessDenied(
        ctx, 
        'botController.admin', 
        { telegramId: ctx.from.id, username: ctx.from?.username, role: user?.role }
      );
      return;
    }
    
    const keyboard = keyboardService.getAdminPanelKeyboard();
    await ctx.reply(
      "🛠️ Панель администратора\n\n" +
      "Выберите раздел для управления:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error("Ошибка при обработке команды /admin:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

// Обработка текстовых команд с кнопок
botController.hears("📝 Подать заявку", async (ctx) => {
  try {
    await ctx.reply(
      '📝 Начинаем процесс подачи заявки на вступление.\n\n' +
      'Пожалуйста, укажите ваш никнейм в Minecraft:'
    );
    
    // Сохраняем шаг в сессии
    if (ctx.session) {
      ctx.session.step = 'waiting_nickname';
      ctx.session.form = {};
    }
  } catch (error) {
    logger.error("Ошибка при обработке кнопки подачи заявки:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

botController.hears("📊 Статус заявки", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    const userRepository = new UserRepository();
    
    // Проверяем, существует ли пользователь
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply(
        '⚠️ Вы еще не подали заявку.\n\n' +
        'Чтобы подать заявку, используйте команду /apply или кнопку "Подать заявку"'
      );
      return;
    }
    
    // Проверяем статус пользователя
    if (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN) {
      await ctx.reply(
        '✅ Вы являетесь членом сообщества и имеете доступ к серверу!\n\n' +
        'Если у вас возникли проблемы с доступом, обратитесь к администратору.'
      );
      return;
    }
    
    // Проверяем, есть ли у пользователя активные заявки
    const applicationRepository = new ApplicationRepository();
    const activeApplications = await applicationRepository.findActiveApplicationsByUserId(user.id);
    
    if (activeApplications.length === 0) {
      await ctx.reply(
        '⚠️ У вас нет активных заявок.\n\n' +
        'Возможно, ваша заявка была уже рассмотрена или вы еще не подавали заявку.\n' +
        'Чтобы подать заявку, используйте команду /apply или кнопку "Подать заявку"'
      );
      return;
    }
    
    // Отправляем статус заявки
    if (activeApplications[0]) {
      await messageService.sendApplicationStatus(ctx, activeApplications[0]);
    } else {
      await ctx.reply('⚠️ Информация о заявке не найдена.');
    }
  } catch (error) {
    logger.error('Ошибка при проверке статуса заявки:', error);
    await ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь к администратору.');
  }
});

botController.hears("ℹ️ Помощь", async (ctx) => {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(messageService.getHelpMessage(), { reply_markup: keyboard });
  } catch (error) {
    logger.error("Ошибка при обработке кнопки помощи:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

botController.hears("📋 О сервере", async (ctx) => {
  try {
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(messageService.getServerInfoMessage(), { reply_markup: keyboard });
  } catch (error) {
    logger.error("Ошибка при обработке кнопки о сервере:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

botController.hears("🛠️ Админ-панель", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user || user.role !== UserRole.ADMIN) {
      await UserUtils.handleAccessDenied(ctx, 'admin_panel');
      return;
    }
    
    const keyboard = keyboardService.getAdminPanelKeyboard();
    await ctx.reply(
      "🛠️ Панель администратора\n\n" +
      "Выберите раздел для управления:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error("Ошибка при обработке кнопки админ-панели:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

// Обработка кнопки возврата в главное меню из админ-панели
botController.callbackQuery("admin_back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery("Возвращаемся в главное меню");
    
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(
      "Главное меню бота для управления доступом к Minecraft-серверу.\n\n" +
      "Используйте кнопки для управления ботом:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error("Ошибка при возврате в главное меню:", error);
    await ctx.answerCallbackQuery("Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
});

// Обработчик кнопки возврата в главное меню для обычных пользователей
botController.callbackQuery("back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    const keyboard = await keyboardService.getMainKeyboard(ctx.from.id);
    await ctx.reply(
      "Главное меню бота для управления доступом к Minecraft-серверу.\n\n" +
      "Используйте кнопки для навигации:", 
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Ошибка при возврате в главное меню:', error);
    await ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки профиля
botController.hears("👤 Профиль", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Вы не зарегистрированы в системе. Пожалуйста, подайте заявку на вступление.');
      return;
    }
    
    // Получаем профиль пользователя
    const profile = await profileService.getProfile(telegramId);
    
    if (!profile) {
      await ctx.reply('❌ Профиль не найден. Возможно, вы еще не являетесь участником сообщества.');
      return;
    }

    // Получаем историю оценок
    const ratingHistory = await profileService.getRatingHistory(profile.user_id);
    
    const reputationScore = profile.positive_ratings_received - profile.negative_ratings_received;
    const reputationEmoji = reputationScore > 0 ? '⭐️' : reputationScore < 0 ? '⚠️' : '➖';
    
    let message = `👤 *Ваш профиль*\n\n`;
    message += `🏷️ *Никнейм:* ${profile.nickname}\n`;
    message += `🎮 *Minecraft:* ${profile.minecraft_username || 'не указан'}\n`;
    message += `📅 *Дата вступления:* ${formatDate(profile.join_date)}\n`;
    message += `${reputationEmoji} *Репутация:* ${reputationScore}\n`;
    message += `👍 *Положительных оценок:* ${profile.positive_ratings_received}\n`;
    message += `👎 *Отрицательных оценок:* ${profile.negative_ratings_received}\n`;
    message += `📊 *Всего оценок получено:* ${profile.total_ratings_received}\n`;
    message += `✍️ *Оценок поставлено:* ${profile.total_ratings_given}\n`;
    
    if (profile.last_rating_given) {
      message += `🕐 *Последняя оценка:* ${formatDate(profile.last_rating_given)}\n`;
    }
    
    if (ratingHistory && ratingHistory.length > 0) {
      message += `\n📈 *Последние полученные оценки:*\n`;
      ratingHistory.slice(0, 5).forEach((rating, index) => {
        const emoji = rating.isPositive ? '👍' : '👎';
        const reason = rating.reason ? ` (${rating.reason})` : '';
        message += `${emoji} от @${rating.raterNickname}${reason}\n`;
      });
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error('Ошибка при обработке кнопки профиля:', error);
    await ctx.reply('😔 Произошла ошибка при загрузке профиля. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки просмотра участников
botController.hears("👥 Участники", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    logger.info(`👥 Пользователь открыл раздел "Участники":`, {
      userId: telegramId,
      username: ctx.from.username,
      chatId: ctx.chat?.id
    });
    
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(telegramId);
    
    // Проверяем права пользователя
    if (!user) {
      await UserUtils.handleAccessDenied(ctx, 'members_not_registered');
      return;
    }
    
    // Только члены и администраторы могут просматривать других участников
    if (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN) {
      await UserUtils.handleAccessDenied(ctx, 'members_role_check');
      return;
    }
    
    // Получаем список всех участников
    const members = await userRepository.findAllMembers();
    
    logger.info(`📋 Получено участников для отображения: ${members ? members.length : 0}`);
    
    if (!members || members.length === 0) {
      logger.warn('⚠️ Список участников пуст');
      await ctx.reply("👥 В системе пока нет активных участников с ролью MEMBER или ADMIN. Пожалуйста, попробуйте позже.");
      return;
    }
    
    // Создаем клавиатуру для выбора пользователя
    logger.info('🔧 Формирование клавиатуры с участниками');
    const keyboard = new InlineKeyboard();
    
    // Добавляем по 2 пользователя в ряд
    for (let i = 0; i < members.length; i += 2) {
      const firstMember = members[i];
      const secondMember = i + 1 < members.length ? members[i + 1] : null;
      
      if (firstMember) {
        const displayName = firstMember.username ? `@${firstMember.username}` : firstMember.minecraftNickname;
        const reputationIndicator = firstMember.reputation > 0 ? '⭐️' : 
                                   firstMember.reputation < 0 ? '⚠️' : '➖';
        
        logger.info(`➕ Добавление участника в клавиатуру:`, {
          userId: firstMember.id,
          displayName,
          reputation: firstMember.reputation,
          callbackData: `select_member_${firstMember.id}`
        });
        
        keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${firstMember.id}`);
      }
      
      if (secondMember) {
        const displayName = secondMember.username ? `@${secondMember.username}` : secondMember.minecraftNickname;
        const reputationIndicator = secondMember.reputation > 0 ? '⭐️' : 
                                   secondMember.reputation < 0 ? '⚠️' : '➖';
        
        logger.info(`➕ Добавление участника в клавиатуру:`, {
          userId: secondMember.id,
          displayName,
          reputation: secondMember.reputation,
          callbackData: `select_member_${secondMember.id}`
        });
        
        keyboard.text(`${reputationIndicator} ${displayName}`, `select_member_${secondMember.id}`);
      }
      
      keyboard.row();
    }
    
    logger.info('📤 Отправка списка участников пользователю');
    
    await ctx.reply("📊 *Список участников для оценки*\n\nВыберите пользователя, чтобы поставить ему оценку:", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    
    logger.info('✅ Список участников успешно отправлен');
    
  } catch (error) {
    logger.error("Ошибка в команде /members:", error);
    await ctx.reply("❌ Произошла ошибка при получении списка участников. Пожалуйста, попробуйте позже.");
  }
});

// Обработка кнопки просмотра активных заявок
botController.hears("🗳️ Активные заявки", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(telegramId);
    
    // Проверяем права пользователя
    if (!user || (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN)) {
      await UserUtils.handleAccessDenied(ctx, 'active_applications');
      return;
    }
    
    // Получаем список активных заявок
    const applicationRepository = new ApplicationRepository();
    const applications = await applicationRepository.findActiveApplications();
    
    if (applications.length === 0) {
      await ctx.reply('📝 Нет активных заявок на данный момент.');
      return;
    }
    
    // Отправляем информацию о каждой заявке
    await ctx.reply('📝 *Активные заявки:*', { parse_mode: 'Markdown' });
    
    for (const application of applications) {
      // Получаем данные пользователя, подавшего заявку
      const applicant = await userRepository.findById(application.userId);
      
      // Формируем информацию о заявке
      const keyboard = ButtonComponents.singleButton('🔍 Просмотреть детали', `app_view_${application.id}`);
      
      // Формируем сообщение с информацией о заявке
      const message = messageService.formatApplicationMessage(
        application,
        applicant.username
      );
      
      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    logger.error('Ошибка при просмотре активных заявок:', error);
    await ctx.reply('😔 Произошла ошибка при получении списка заявок. Пожалуйста, попробуйте позже.');
  }
});

export { botController };