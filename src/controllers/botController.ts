import { Composer } from 'grammy';
import type { MyContext } from '../index';
import { keyboardService } from '../services/keyboardService';
import { handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
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
    const keyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
    await ctx.reply(messageService.getHelpMessage(), { reply_markup: keyboard });
  } catch (error) {
    logger.error("Ошибка при обработке команды /help:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
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

// Обработка кнопки возврата в главное меню
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

export { botController }; 