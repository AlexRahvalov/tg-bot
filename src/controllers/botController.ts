import { Composer, Bot, InlineKeyboard } from 'grammy';
import type { MyContext } from '../models/sessionTypes';
import { keyboardService } from '../services/keyboardService';
import { handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole, ApplicationStatus } from '../models/types';
import { logger } from '../utils/logger';
import { messageService } from '../services/messageService';
import { ApplicationRepository } from '../db/repositories/applicationRepository';
import config from '../config/env';

// Создаем репозиторий пользователей для проверки прав
const userRepository = new UserRepository();

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
botController.command("start", async (ctx, next) => {
  try {
    // Проверяем, был ли ответ уже отправлен в applicationController
    if (ctx.session?.__processed) {
      return;
    }
    
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(messageService.getStartMessage(), { reply_markup: keyboard });
    
    // Помечаем сообщение как обработанное
    if (ctx.session) {
      ctx.session.__processed = true;
    }
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
      await ctx.reply(
        "⚠️ У вас нет прав доступа к этой функции.",
        { reply_markup: keyboard }
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

// Добавляем обработчик команды status в botController
botController.command("status", async (ctx) => {
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

// Обработка текстовых команд с кнопок
botController.hears("📝 Подать заявку", async (ctx) => {
  try {
    // Помечаем сообщение как обработанное
    if (ctx.session) {
      ctx.session.__processed = true;
    }
    
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    const userRepository = new UserRepository();
    
    // Проверяем, существует ли пользователь и его статус
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (user) {
      // Проверяем, является ли пользователь уже участником
      if (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN) {
        await ctx.reply(
          '⚠️ Вы уже являетесь участником сервера.\n\n' +
          'Если у вас возникли проблемы с доступом, обратитесь к администратору.'
        );
        return;
      }
      
      // Проверяем, есть ли уже одобренная заявка
      const applicationRepository = new ApplicationRepository();
      const applications = await applicationRepository.findAllApplicationsByUserId(user.id);
      
      const hasApprovedApplication = applications.some((app) => app.status === ApplicationStatus.APPROVED);
      if (hasApprovedApplication) {
        await ctx.reply(
          '⚠️ У вас уже есть одобренная заявка.\n\n' +
          'Если у вас возникли проблемы с доступом, обратитесь к администратору.'
        );
        return;
      }
      
      // Проверяем, есть ли активные заявки
      const activeApplications = await applicationRepository.findActiveApplicationsByUserId(user.id);
      if (activeApplications.length > 0) {
        await ctx.reply(
          '⚠️ У вас уже есть активная заявка.\n\n' +
          'Дождитесь рассмотрения текущей заявки или обратитесь к администраторам сервера.'
        );
        return;
      }
    }
    
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
      const keyboard = await keyboardService.getMainKeyboard(ctx.from.id);
      await ctx.reply(
        "⚠️ У вас нет прав доступа к админ-панели.",
        { reply_markup: keyboard }
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

// Обработка кнопки просмотра активных заявок
botController.hears("🗳️ Активные заявки", async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id;
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(telegramId);
    
    // Проверяем права пользователя
    if (!user || (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN)) {
      await ctx.reply('⚠️ У вас нет доступа к просмотру активных заявок.');
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
      const keyboard = new InlineKeyboard()
        .text('🔍 Просмотреть детали', `app_view_${application.id}`);
      
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