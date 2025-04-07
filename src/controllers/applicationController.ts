import { Bot, Composer, InlineKeyboard } from "grammy";
import type { MyContext } from "../index";
import { handleError } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { UserRepository } from "../db/repositories/userRepository";
import { UserRole, ApplicationStatus, type Application } from "../models/types";
import { ApplicationRepository } from "../db/repositories/applicationRepository";
import { keyboardService } from "../services/keyboardService";
import { messageService } from "../services/messageService";
import { botController } from './botController';

// Создаем экземпляр композера для контроллера заявок
const applicationController = new Composer<MyContext>();

// Объявляем переменную для хранения экземпляра бота
let botInstance: Bot<MyContext> | null = null;

// Функция для установки экземпляра бота
export function setBotInstance(bot: Bot<MyContext>): void {
  botInstance = bot;
  logger.info("✅ Бот установлен в контроллере заявок");
}

// Функция для получения экземпляра бота
export function getBotInstance(): Bot<MyContext> | null {
  return botInstance;
}

// Команда для подачи заявки
applicationController.command("apply", handleError(async (ctx: MyContext) => {
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
    
    const hasApprovedApplication = applications.some((app: Application) => app.status === ApplicationStatus.APPROVED);
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
  
  // Если все проверки пройдены, начинаем процесс подачи заявки
  await ctx.reply(
    '📝 Начинаем процесс подачи заявки на вступление.\n\n' +
    'Пожалуйста, укажите ваш никнейм в Minecraft:'
  );
  
  // Сохраняем шаг в сессии
  if (ctx.session) {
    ctx.session.step = 'waiting_nickname';
    ctx.session.form = {};
  }
}));

// Обработка кнопки подачи заявки через inline keyboard
applicationController.callbackQuery('start_application', handleError(async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
    return;
  }
  
  await ctx.answerCallbackQuery();
  
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
    
    const hasApprovedApplication = applications.some((app: Application) => app.status === ApplicationStatus.APPROVED);
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
  
  // Если все проверки пройдены, начинаем процесс подачи заявки
  await ctx.reply(
    '📝 Начинаем процесс подачи заявки на вступление.\n\n' +
    'Пожалуйста, укажите ваш никнейм в Minecraft:'
  );
  
  // Сохраняем шаг в сессии
  if (ctx.session) {
    ctx.session.step = 'waiting_nickname';
    ctx.session.form = {};
  }
}));

// Обработка кнопки подачи заявки в главном меню
botController.hears("📝 Подать заявку", async (ctx: MyContext) => {
  if (!ctx.from) return;
  
  const telegramId = ctx.from.id;
  const userRepository = new UserRepository();
  
  try {
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
      
      const hasApprovedApplication = applications.some((app: Application) => app.status === ApplicationStatus.APPROVED);
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
    
    // Если все проверки пройдены, начинаем процесс подачи заявки
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

// Команда для проверки статуса заявки
applicationController.command("status", handleError(async (ctx: MyContext) => {
  if (!ctx.from) return;
  
  const telegramId = ctx.from.id;
  const userRepository = new UserRepository();
  const applicationRepository = new ApplicationRepository();
  
  try {
    // Проверяем, существует ли пользователь
    const user = await userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply(
        '⚠️ Вы еще не подали заявку.\n\n' +
        'Чтобы подать заявку, используйте команду /apply'
      );
      return;
    }
    
    // Получаем активные заявки пользователя
    const activeApplications = await applicationRepository.findActiveApplicationsByUserId(user.id);
    
    if (activeApplications.length === 0) {
      // Проверяем, является ли пользователь членом сообщества
      if (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN) {
        await ctx.reply(
          '✅ Вы являетесь членом сообщества и имеете доступ к серверу!\n\n' +
          'Если у вас возникли проблемы с доступом, обратитесь к администратору.'
        );
        return;
      }
      
      await ctx.reply(
        '⚠️ У вас нет активных заявок.\n\n' +
        'Возможно, ваша заявка была уже рассмотрена или вы еще не подавали заявку.\n' +
        'Чтобы подать заявку, используйте команду /apply'
      );
      return;
    }
    
    // Выводим информацию о заявке
    const application = activeApplications[0];
    if (application) {
      await messageService.sendApplicationStatus(ctx, application);
    } else {
      await ctx.reply('⚠️ Информация о заявке не найдена.');
    }
    
  } catch (error) {
    logger.error('Ошибка при обработке команды /status:', error);
    await ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь к администратору.');
  }
}));

// Обработчик для получения никнейма в Minecraft
applicationController.on('message', async (ctx, next) => {
  if (!ctx.message || !ctx.from || !ctx.message.text) return next();
  
  // Обрабатываем шаг ввода никнейма Minecraft
  if (ctx.session?.step === 'waiting_nickname') {
    const minecraftNickname = ctx.message.text.trim();
    
    // Проверяем валидность никнейма
    if (minecraftNickname.length < 3 || minecraftNickname.length > 16 || !/^[a-zA-Z0-9_]+$/.test(minecraftNickname)) {
      await ctx.reply(
        '❌ Некорректный никнейм.\n\n' +
        'Никнейм должен быть от 3 до 16 символов и может содержать только буквы, цифры и подчеркивания.\n' +
        'Пожалуйста, введите корректный никнейм:'
      );
      return;
    }
    
    // Сохраняем никнейм и переходим к следующему шагу
    if (!ctx.session.form) ctx.session.form = {};
    ctx.session.form.minecraftNickname = minecraftNickname;
    ctx.session.step = 'waiting_reason';
    
    await ctx.reply(
      `✅ Никнейм принят: ${minecraftNickname}\n\n` +
      'Теперь, пожалуйста, укажите причину, по которой вы хотите присоединиться к нашему серверу.\n' +
      'Напишите немного о себе, своем игровом опыте и о том, что вас привлекает в нашем сервере:'
    );
    
    return;
  }
  
  // Обрабатываем шаг ввода причины присоединения
  if (ctx.session?.step === 'waiting_reason' && ctx.session.form?.minecraftNickname) {
    const reason = ctx.message.text.trim();
    
    // Проверяем длину причины
    if (reason.length < 10) {
      await ctx.reply(
        '❌ Слишком короткая причина.\n\n' +
        'Пожалуйста, расскажите подробнее о себе и о том, почему вы хотите присоединиться к нашему серверу:'
      );
      return;
    }
    
    // Сохраняем причину
    ctx.session.form.reason = reason;
    ctx.session.step = 'confirmation';
    
    // Создаем клавиатуру для подтверждения
    const keyboard = new InlineKeyboard()
      .text('✅ Подтвердить', 'confirm_application')
      .text('❌ Отменить', 'cancel_application');
    
    await ctx.reply(
      '📋 Проверьте данные вашей заявки:\n\n' +
      `🎮 Никнейм: ${ctx.session.form.minecraftNickname}\n` +
      `📝 Причина: ${reason}\n\n` +
      'Всё верно? Подтвердите отправку заявки или отмените, чтобы начать заново:',
      { reply_markup: keyboard }
    );
    
    return;
  }
  
  return next();
});

// Подтверждение и создание заявки
applicationController.callbackQuery('confirm_application', handleError(async (ctx) => {
  if (!ctx.from || !ctx.session?.form?.minecraftNickname || !ctx.session.form.reason) {
    await ctx.answerCallbackQuery('⚠️ Недостаточно данных для создания заявки');
    return;
  }
  
  await ctx.answerCallbackQuery();
  
  const telegramId = ctx.from.id;
  const minecraftNickname = ctx.session.form.minecraftNickname;
  const reason = ctx.session.form.reason;
  
  // Получаем username пользователя, если он есть
  const username = ctx.from.username || 'Пользователь';
  
  const userRepository = new UserRepository();
  
  try {
    // Проверяем, существует ли пользователь
    let user = await userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      // Создаем нового пользователя
      user = await userRepository.create({
        telegramId,
        username: ctx.from.username || undefined, // Используем undefined, если username не указан
        minecraftNickname,
        role: UserRole.APPLICANT,
        canVote: false
      });
    } else {
      // Обновляем данные существующего пользователя
      user = await userRepository.update(user.id, {
        username: ctx.from.username || undefined, // Обновляем username, если он изменился
        minecraftNickname
      });
    }
    
    const applicationRepository = new ApplicationRepository();
    
    // Проверяем, есть ли активные заявки
    const activeApplications = await applicationRepository.findActiveApplicationsByUserId(user.id);
    
    if (activeApplications.length > 0) {
      await ctx.reply(
        '⚠️ У вас уже есть активная заявка.\n\n' +
        'Дождитесь рассмотрения текущей заявки или обратитесь к администраторам сервера.'
      );
      return;
    }
    
    // Создаем новую заявку
    const applicationForm = {
      userId: user.id,
      minecraftNickname,
      reason,
      status: ApplicationStatus.PENDING
    };
    
    const application = await applicationRepository.create(applicationForm);
    
    // Очищаем данные сессии
    ctx.session.form = {};
    ctx.session.step = undefined;
    
    // Отправляем подтверждение
    const mainKeyboard = await keyboardService.getMainKeyboard(ctx.from.id);
    await ctx.reply(
      '✅ Ваша заявка на вступление успешно отправлена!\n\n' +
      'Администраторы рассмотрят её в ближайшее время. Вы получите уведомление, когда статус вашей заявки изменится.\n\n' +
      'Вы можете проверить статус своей заявки с помощью команды /status',
      { reply_markup: mainKeyboard }
    );
    
    // Уведомляем администраторов о новой заявке
    if (botInstance) {
      // Получаем список администраторов
      const admins = await userRepository.findAdmins();
      
      if (admins.length > 0) {
        // Клавиатура для быстрого просмотра заявки
        const adminKeyboard = new InlineKeyboard()
          .text('🔍 Просмотреть заявку', `app_view_${application.id}`);
        
        // Отправляем уведомление каждому администратору
        for (const admin of admins) {
          try {
            await botInstance.api.sendMessage(
              Number(admin.telegramId),
              `🆕 Поступила новая заявка на вступление!\n\n` +
              `👤 Пользователь: ${username}\n` +
              `🎮 Никнейм: ${minecraftNickname}\n` +
              `📝 Причина: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
              { reply_markup: adminKeyboard }
            );
          } catch (error) {
            logger.error(`Ошибка при отправке уведомления администратору ${admin.telegramId}:`, error);
          }
        }
      }
    }
    
  } catch (error) {
    logger.error('Ошибка при создании заявки:', error);
    await ctx.reply('😔 Произошла ошибка при создании заявки. Пожалуйста, попробуйте позже.');
  }
}));

// Обработка кнопки отмены заявки
applicationController.callbackQuery('cancel_application', handleError(async (ctx) => {
  await ctx.answerCallbackQuery('Заявка отменена');
  
  // Очищаем данные сессии
  if (ctx.session) {
    ctx.session.form = {};
    ctx.session.step = undefined;
  }
  
  // Возвращаем пользователя в главное меню
  const mainKeyboard = await keyboardService.getMainKeyboard(ctx.from?.id);
  await ctx.reply(
    '❌ Заявка отменена.\n\n' +
    'Вы можете начать процесс подачи заявки заново с помощью команды /apply',
    { reply_markup: mainKeyboard }
  );
}));

export { applicationController }; 