import { Bot, Composer, InlineKeyboard } from "grammy";
import type { MyContext } from "../index";
import { handleError } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { UserRepository } from "../db/repositories/userRepository";
import { ApplicationStatus, VoteType, UserRole, type Application, type CreateVoteRequest } from "../models/types";
import type { User } from "../models/types";
import { ApplicationRepository } from "../db/repositories/applicationRepository";
import { keyboardService } from "../services/keyboardService";
import { messageService } from "../services/messageService";
import { botController } from './botController';
import { QuestionRepository } from "../db/repositories/questionRepository";
import { VoteRepository } from "../db/repositories/voteRepository";
import { ButtonComponents } from "../components/buttons";
import { RoleManager } from "../components/roles";

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

// Функция для экранирования специальных символов Markdown
function escapeMarkdown(text: string): string {
  if (!text) return '';
  // Экранируем спецсимволы Markdown: * _ ` [ ]
  return text.replace(/([*_`\[\]])/g, '\\$1');
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
    if (RoleManager.isMemberOrAdmin(user)) {
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
    if (RoleManager.isMemberOrAdmin(user)) {
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
      if (RoleManager.isMemberOrAdmin(user)) {
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
      if (RoleManager.isMemberOrAdmin(user)) {
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
    const keyboard = ButtonComponents.confirmCancel('confirm_application', 'cancel_application');
    
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
        role: RoleManager.ROLES.APPLICANT,
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
        const adminKeyboard = ButtonComponents.singleButton('🔍 Просмотреть заявку', `app_view_${application.id}`);
        
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
      
      // Получаем всех участников с правом голоса, чтобы уведомить их о новой заявке
      const voters = await userRepository.findVoters();
      
      if (voters.length > 0) {
        // Клавиатура для быстрого просмотра заявки
        const voterKeyboard = ButtonComponents.singleButton('🔍 Просмотреть заявку', `app_view_${application.id}`);
        
        // Отправляем уведомление каждому участнику с правом голоса
        for (const voter of voters) {
          // Пропускаем администраторов, они уже получили уведомление
          const isAdmin = admins.some(admin => admin.id === voter.id);
          if (isAdmin) continue;
          
          try {
            await botInstance.api.sendMessage(
              Number(voter.telegramId),
              `🆕 Поступила новая заявка на вступление!\n\n` +
              `👤 Пользователь: ${username}\n` +
              `🎮 Никнейм: ${minecraftNickname}\n` +
              `📝 Причина: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}\n\n` +
              `Для голосования дождитесь, когда администратор запустит процесс голосования.`,
              { reply_markup: voterKeyboard }
            );
          } catch (error) {
            logger.error(`Ошибка при отправке уведомления участнику ${voter.telegramId}:`, error);
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

// Обработка просмотра заявки обычными пользователями
applicationController.callbackQuery(/^app_view_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные заявки
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена');
      return;
    }
    
    // Получаем данные пользователя, подавшего заявку
    const userRepository = new UserRepository();
    const user = await userRepository.findById(application.userId);
    
    // Получаем количество вопросов к заявке
    const questionRepository = new QuestionRepository();
    const questions = await questionRepository.findByApplicationId(applicationId);
    
    // Форматируем сообщение с данными заявки
    const message = messageService.formatApplicationMessage(
      application,
      user.username,
      questions.length
    );
    
    // Создаем клавиатуру для действий с заявкой
    let keyboard = new InlineKeyboard();
    
    // Если заявка находится на голосовании, добавляем кнопки для голосования
    if (application.status === ApplicationStatus.VOTING) {
      // Проверяем, голосовал ли пользователь ранее
      const voteRepository = new VoteRepository();
      const telegramId = ctx.from?.id || 0;
      const currentUser = await userRepository.findByTelegramId(telegramId);
      
      if (currentUser && currentUser.canVote) {
        const hasVoted = await voteRepository.hasVoted(applicationId, currentUser.id);
        keyboard = ButtonComponents.fullVoting(applicationId, hasVoted);
      }
    }
    
    // Добавляем кнопку для просмотра вопросов, если они есть
    if (questions.length > 0) {
      keyboard.text(`📝 Вопросы (${questions.length})`, `view_questions_${applicationId}`).row();
    }
    
    // Кнопка для возврата в главное меню
    keyboard.text("🔙 В главное меню", "back_to_main");
    
    await ctx.reply(message, { 
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });
  } catch (error) {
    logger.error('Ошибка при просмотре заявки:', error);
    await ctx.reply('😔 Произошла ошибка при просмотре заявки. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик положительного голоса за заявку
applicationController.callbackQuery(/^vote_positive_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные о заявке
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена.');
      return;
    }
    
    // Проверяем, что заявка находится в статусе голосования
    if (application.status !== ApplicationStatus.VOTING) {
      await ctx.reply('⚠️ Голосование по этой заявке уже завершено или ещё не начато.');
      return;
    }
    
    // Получаем данные пользователя, голосующего за заявку
    const userRepository = new UserRepository();
    const voter = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!voter) {
      await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
      return;
    }
    
    // Проверяем, есть ли у пользователя право голоса
    if (!voter.canVote) {
      await ctx.reply('⚠️ У вас нет прав для голосования по заявкам.');
      return;
    }
    
    // Добавляем положительный голос (с автоматической проверкой и обновлением счетчиков)
    const voteRepository = new VoteRepository();
    try {
      await voteRepository.addVote({
        applicationId,
        voterId: voter.id,
        voteType: VoteType.POSITIVE
      });
    } catch (error: any) {
      if (error.message?.includes('уже проголосовал')) {
        await ctx.reply('⚠️ Вы уже проголосовали по этой заявке.');
        return;
      }
      throw error;
    }
    
    // Получаем обновленные счетчики голосов
    const votes = await voteRepository.countVotes(applicationId);
    
    // Отправляем подтверждение голосования
    await ctx.reply(
      messageService.formatVotingResultsMessage(
        applicationId,
        votes.positive,
        votes.negative,
        true
      )
    );
    
    logger.info(`Пользователь ${voter.id} проголосовал ЗА заявку ${applicationId}`);
  } catch (error) {
    logger.error('Ошибка при голосовании за заявку:', error);
    await ctx.reply('😔 Произошла ошибка при голосовании. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик отрицательного голоса за заявку
applicationController.callbackQuery(/^vote_negative_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные о заявке
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена.');
      return;
    }
    
    // Проверяем, что заявка находится в статусе голосования
    if (application.status !== ApplicationStatus.VOTING) {
      await ctx.reply('⚠️ Голосование по этой заявке уже завершено или ещё не начато.');
      return;
    }
    
    // Получаем данные пользователя, голосующего за заявку
    const userRepository = new UserRepository();
    const voter = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!voter) {
      await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
      return;
    }
    
    // Проверяем, есть ли у пользователя право голоса
    if (!voter.canVote) {
      await ctx.reply('⚠️ У вас нет прав для голосования по заявкам.');
      return;
    }
    
    // Добавляем отрицательный голос (с автоматической проверкой и обновлением счетчиков)
    const voteRepository = new VoteRepository();
    try {
      await voteRepository.addVote({
        applicationId,
        voterId: voter.id,
        voteType: VoteType.NEGATIVE
      });
    } catch (error: any) {
      if (error.message?.includes('уже проголосовал')) {
        await ctx.reply('⚠️ Вы уже проголосовали по этой заявке.');
        return;
      }
      throw error;
    }
    
    // Получаем обновленные счетчики голосов
    const votes = await voteRepository.countVotes(applicationId);
    
    // Отправляем подтверждение голосования
    await ctx.reply(
      messageService.formatVotingResultsMessage(
        applicationId,
        votes.positive,
        votes.negative,
        false
      )
    );
    
    logger.info(`Пользователь ${voter.id} проголосовал ПРОТИВ заявки ${applicationId}`);
  } catch (error) {
    logger.error('Ошибка при голосовании против заявки:', error);
    await ctx.reply('😔 Произошла ошибка при голосовании. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик кнопки "Задать вопрос"
applicationController.callbackQuery(/^ask_question_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные о заявке
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена.');
      return;
    }
    
    // Проверяем, что заявка находится в активном статусе
    if (application.status !== ApplicationStatus.PENDING && application.status !== ApplicationStatus.VOTING) {
      await ctx.reply('⚠️ Нельзя задавать вопросы к неактивной заявке.');
      return;
    }
    
    // Получаем данные пользователя, задающего вопрос
    const userRepository = new UserRepository();
    const asker = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!asker) {
      await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
      return;
    }
    
    // Проверяем, что пользователь не задает вопрос к своей заявке
    if (asker.id === application.userId) {
      await ctx.reply('⚠️ Вы не можете задавать вопросы к своей заявке.');
      return;
    }
    
    // Сохраняем ID заявки в сессии
    if (ctx.session) {
      ctx.session.step = 'waiting_question';
      ctx.session.applicationId = applicationId;
    }
    
    await ctx.reply(
      '❓ Введите ваш вопрос к заявителю:\n\n' +
      'Вопрос будет отправлен пользователю напрямую. ' +
      'Ответ вы получите в личном сообщении.'
    );
    
  } catch (error) {
    logger.error('Ошибка при запросе на задание вопроса:', error);
    await ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик для получения текста вопроса
applicationController.on('message', async (ctx, next) => {
  if (!ctx.message || !ctx.from || !ctx.message.text) return next();
  
  // Обрабатываем шаг ввода вопроса к заявке
  if (ctx.session?.step === 'waiting_question' && ctx.session.applicationId) {
    const questionText = ctx.message.text.trim();
    
    // Проверяем длину вопроса
    if (questionText.length < 5) {
      await ctx.reply(
        '❌ Слишком короткий вопрос.\n\n' +
        'Пожалуйста, сформулируйте более подробный вопрос:'
      );
      return;
    }
    
    try {
      const applicationId = ctx.session.applicationId;
      
      // Получаем данные о заявке
      const applicationRepository = new ApplicationRepository();
      const application = await applicationRepository.findById(applicationId);
      
      if (!application) {
        await ctx.reply('⚠️ Заявка не найдена.');
        ctx.session.step = undefined;
        ctx.session.applicationId = undefined;
        return;
      }
      
      // Получаем данные пользователей
      const userRepository = new UserRepository();
      const asker = await userRepository.findByTelegramId(ctx.from.id);
      const applicant = await userRepository.findById(application.userId);
      
      if (!asker || !applicant) {
        await ctx.reply('⚠️ Ошибка при получении данных пользователей.');
        ctx.session.step = undefined;
        ctx.session.applicationId = undefined;
        return;
      }
      
      // Добавляем вопрос в базу данных
      const questionRepository = new QuestionRepository();
      const questionId = await questionRepository.addQuestion({
        applicationId,
        askerId: asker.id,
        text: questionText
      });
      
      // Отправляем уведомление пользователю, задавшему вопрос
      await ctx.reply(
        `✅ Ваш вопрос успешно отправлен пользователю ${applicant.minecraftNickname}.\n\n` +
        'Вы получите уведомление, когда он ответит на ваш вопрос.'
      );
      
      // Отправляем уведомление заявителю
      if (botInstance) {
        try {
          // Создаем клавиатуру для ответа на вопрос
          const keyboard = new InlineKeyboard()
            .text('💬 Ответить', `answer_question_${questionId}`);
          
          await botInstance.api.sendMessage(
            Number(applicant.telegramId),
            `❓ Вам задан вопрос по вашей заявке #${applicationId}:\n\n` +
            `От: ${asker.username ? `@${asker.username}` : asker.minecraftNickname}\n` +
            `Вопрос: ${questionText}\n\n` +
            `Пожалуйста, ответьте на вопрос, нажав кнопку ниже.`,
            { reply_markup: keyboard }
          );
        } catch (error) {
          logger.error(`Ошибка при отправке уведомления о вопросе пользователю ${applicant.telegramId}:`, error);
        }
      }
      
      // Очищаем данные сессии
      ctx.session.step = undefined;
      ctx.session.applicationId = undefined;
      
    } catch (error) {
      logger.error('Ошибка при создании вопроса:', error);
      await ctx.reply('😔 Произошла ошибка при отправке вопроса. Пожалуйста, попробуйте позже.');
      
      // Очищаем данные сессии
      ctx.session.step = undefined;
      ctx.session.applicationId = undefined;
    }
    
    return;
  }
  
  // Обрабатываем шаг ввода ответа на вопрос
  if (ctx.session?.step === 'waiting_answer' && ctx.session.questionId) {
    const answerText = ctx.message.text.trim();
    
    // Проверяем длину ответа
    if (answerText.length < 3) {
      await ctx.reply(
        '❌ Слишком короткий ответ.\n\n' +
        'Пожалуйста, дайте более подробный ответ:'
      );
      return;
    }
    
    try {
      const questionId = ctx.session.questionId;
      
      // Получаем данные о вопросе
      const questionRepository = new QuestionRepository();
      const question = await questionRepository.findById(questionId);
      
      if (!question) {
        await ctx.reply('⚠️ Вопрос не найден.');
        ctx.session.step = undefined;
        ctx.session.questionId = undefined;
        return;
      }
      
      // Получаем данные о заявке
      const applicationRepository = new ApplicationRepository();
      const application = await applicationRepository.findById(question.applicationId);
      
      if (!application) {
        await ctx.reply('⚠️ Заявка не найдена.');
        ctx.session.step = undefined;
        ctx.session.questionId = undefined;
        return;
      }
      
      // Проверяем, что отвечает владелец заявки
      if (application.userId !== ctx.from.id) {
        const userRepository = new UserRepository();
        const user = await userRepository.findByTelegramId(ctx.from.id);
        
        if (!user || user.id !== application.userId) {
          await ctx.reply('⚠️ Вы не можете отвечать на вопросы к чужой заявке.');
          ctx.session.step = undefined;
          ctx.session.questionId = undefined;
          return;
        }
      }
      
      // Сохраняем ответ на вопрос
      await questionRepository.answerQuestion(questionId, answerText);
      
      // Отправляем уведомление пользователю, ответившему на вопрос
      await ctx.reply(
        '✅ Ваш ответ успешно отправлен.'
      );
      
      // Получаем данные пользователя, задавшего вопрос
      const userRepository = new UserRepository();
      const asker = await userRepository.findById(question.askerId);
      const applicant = await userRepository.findById(application.userId);
      
      // Отправляем уведомление пользователю, задавшему вопрос
      if (botInstance && asker) {
        try {
          await botInstance.api.sendMessage(
            Number(asker.telegramId),
            `💬 Получен ответ на ваш вопрос к заявке #${application.id}:\n\n` +
            `Вопрос: ${question.text}\n\n` +
            `Ответ от ${applicant.minecraftNickname}: ${answerText}`
          );
        } catch (error) {
          logger.error(`Ошибка при отправке уведомления об ответе пользователю ${asker.telegramId}:`, error);
        }
      }
      
      // Очищаем данные сессии
      ctx.session.step = undefined;
      ctx.session.questionId = undefined;
      
    } catch (error) {
      logger.error('Ошибка при сохранении ответа:', error);
      await ctx.reply('😔 Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.');
      
      // Очищаем данные сессии
      ctx.session.step = undefined;
      ctx.session.questionId = undefined;
    }
    
    return;
  }
  
  return next();
});

// Обработчик кнопки "Ответить на вопрос"
applicationController.callbackQuery(/^answer_question_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    // Извлекаем ID вопроса из callback данных
    const questionId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные о вопросе
    const questionRepository = new QuestionRepository();
    const question = await questionRepository.findById(questionId);
    
    if (!question) {
      await ctx.reply('⚠️ Вопрос не найден.');
      return;
    }
    
    // Получаем данные о заявке
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(question.applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена.');
      return;
    }
    
    // Получаем данные пользователя
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user) {
      await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
      return;
    }
    
    // Проверяем, что отвечает владелец заявки
    if (user.id !== application.userId) {
      await ctx.reply('⚠️ Вы не можете отвечать на вопросы к чужой заявке.');
      return;
    }
    
    // Проверяем, что на вопрос еще не ответили
    if (question.answer) {
      await ctx.reply(
        '⚠️ Вы уже ответили на этот вопрос.\n\n' +
        `Вопрос: ${question.text}\n` +
        `Ваш ответ: ${question.answer}`
      );
      return;
    }
    
    // Получаем данные пользователя, задавшего вопрос
    const asker = await userRepository.findById(question.askerId);
    
    if (!asker) {
      await ctx.reply('⚠️ Не удалось получить данные о пользователе, задавшем вопрос.');
      return;
    }
    
    // Сохраняем ID вопроса в сессии
    if (ctx.session) {
      ctx.session.step = 'waiting_answer';
      ctx.session.questionId = questionId;
    }
    
    await ctx.reply(
      `💬 Ответ на вопрос от ${asker.username ? `@${asker.username}` : asker.minecraftNickname}:\n\n` +
      `${question.text}\n\n` +
      'Введите ваш ответ:'
    );
    
  } catch (error) {
    logger.error('Ошибка при запросе на ответ на вопрос:', error);
    await ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка просмотра вопросов к заявке
applicationController.callbackQuery(/^view_questions_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные о заявке
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(applicationId);
    
    if (!application) {
      await ctx.reply('⚠️ Заявка не найдена.');
      return;
    }
    
    // Получаем данные пользователя
    const userRepository = new UserRepository();
    const currentUser = await userRepository.findByTelegramId(ctx.from.id);
    const applicant = await userRepository.findById(application.userId);
    
    if (!currentUser) {
      await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
      return;
    }
    
    // Получаем вопросы к заявке
    const questionRepository = new QuestionRepository();
    const questions = await questionRepository.findByApplicationId(applicationId);
    
    if (questions.length === 0) {
      await ctx.reply('📝 К этой заявке еще не задано ни одного вопроса.');
      return;
    }
    
    // Проверяем права на просмотр вопросов (только владелец заявки, администратор или тот, кто задал вопрос)
    const isAdmin = RoleManager.isAdmin(currentUser);
    const isApplicant = currentUser.id === application.userId;
    
    // Фильтруем вопросы в зависимости от прав
    const accessibleQuestions = isAdmin || isApplicant
      ? questions
      : questions.filter(q => q.askerId === currentUser.id);
    
    if (accessibleQuestions.length === 0) {
      await ctx.reply('📝 У вас нет доступа к вопросам этой заявки.');
      return;
    }
    
    // Формируем сообщение с вопросами
    let message = `📝 Вопросы к заявке #${applicationId} (${applicant.minecraftNickname}):\n\n`;
    
    for (const question of accessibleQuestions) {
      const asker = await userRepository.findById(question.askerId);
      
      message += `❓ *Вопрос от ${asker.username ? `@${asker.username}` : asker.minecraftNickname}:*\n`;
      message += `${question.text}\n\n`;
      
      if (question.answer) {
        message += `💬 *Ответ:*\n`;
        message += `${question.answer}\n\n`;
      } else {
        message += `⏳ *Ответ ожидается*\n\n`;
      }
    }
    
    // Отправляем сообщение с вопросами
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error('Ошибка при просмотре вопросов:', error);
    await ctx.reply('😔 Произошла ошибка при получении вопросов. Пожалуйста, попробуйте позже.');
  }
});

// Обработка просмотра своих заявок
applicationController.command("applications", handleError(async (ctx: MyContext) => {
  if (!ctx.from) return;
  
  const telegramId = ctx.from.id;
  const userRepository = new UserRepository();
  
  // Получаем данные пользователя
  const user = await userRepository.findByTelegramId(telegramId);
  
  if (!user) {
    await ctx.reply(
      '⚠️ Вы не зарегистрированы в системе.\n\n' +
      'Для начала работы, пожалуйста, отправьте команду /start.'
    );
    return;
  }
  
  // Получаем заявки пользователя
  const applicationRepository = new ApplicationRepository();
  const applications = await applicationRepository.findAllApplicationsByUserId(user.id);
  
  if (applications.length === 0) {
    const keyboard = await keyboardService.getMainKeyboard(user.telegramId);
    await ctx.reply(
      '⚠️ У вас нет поданных заявок.\n\n' +
      'Чтобы подать заявку на вступление, используйте команду /apply или соответствующую кнопку в главном меню.',
      { 
        reply_markup: keyboard,
        parse_mode: "Markdown"
      }
    );
    return;
  }
  
  // Формируем сообщение со списком заявок
  let message = '📋 *Ваши заявки:*\n\n';
  
  applications.forEach((app, index) => {
    const status = app.status === ApplicationStatus.PENDING ? '⏳ Ожидает рассмотрения' :
                  app.status === ApplicationStatus.VOTING ? '🗳️ На голосовании' :
                  app.status === ApplicationStatus.APPROVED ? '✅ Одобрена' :
                  app.status === ApplicationStatus.REJECTED ? '❌ Отклонена' :
                  app.status === ApplicationStatus.EXPIRED ? '⏰ Истекла' : 'Неизвестно';
    
    const createdDate = app.createdAt.toLocaleString('ru-RU');
    
    message += `*${index + 1}.* Заявка #${app.id} (${status})\n` +
               `📅 Создана: ${createdDate}\n\n`;
  });
  
  message += 'Нажмите на кнопку для просмотра подробной информации о заявке.';
  
  // Создаем клавиатуру для просмотра заявок
  const keyboard = new InlineKeyboard();
  
  applications.forEach((app, index) => {
    keyboard.text(`Заявка #${app.id}`, `show_application_${app.id}`).row();
  });
  
  keyboard.text('🔙 Главное меню', 'back_to_main');
  
  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
}));

// Обработка просмотра деталей заявки
applicationController.callbackQuery(/^show_application_(\d+)$/, handleError(async (ctx) => {
  if (!ctx.from) return;
  
  await ctx.answerCallbackQuery();
  
  const applicationId = parseInt(ctx.match?.[1] || '0');
  const telegramId = ctx.from.id;
  
  const userRepository = new UserRepository();
  const user = await userRepository.findByTelegramId(telegramId);
  
  if (!user) {
    await ctx.reply(
      '⚠️ Вы не зарегистрированы в системе.\n\n' +
      'Для начала работы, пожалуйста, отправьте команду /start.'
    );
    return;
  }
  
  // Получаем данные заявки
  const applicationRepository = new ApplicationRepository();
  const application = await applicationRepository.findById(applicationId);
  
  // Проверяем, принадлежит ли заявка пользователю
  if (application.userId !== user.id) {
    await ctx.reply(
      '⚠️ Эта заявка вам не принадлежит.'
    );
    return;
  }
  
  // Получаем количество вопросов к заявке
  const questionRepository = new QuestionRepository();
  const questions = await questionRepository.findByApplicationId(applicationId);
  
  // Формируем сообщение с информацией о заявке
  const status = application.status === ApplicationStatus.PENDING ? '⏳ Ожидает рассмотрения' :
                application.status === ApplicationStatus.VOTING ? '🗳️ На голосовании' :
                application.status === ApplicationStatus.APPROVED ? '✅ Одобрена' :
                application.status === ApplicationStatus.REJECTED ? '❌ Отклонена' :
                application.status === ApplicationStatus.EXPIRED ? '⏰ Истекла' : 'Неизвестно';
  
  const createdDate = application.createdAt.toLocaleString('ru-RU');
  
  let message = `📋 *Заявка #${application.id}*\n\n` +
               `🎮 *Никнейм:* ${escapeMarkdown(application.minecraftNickname)}\n` +
               `📊 *Статус:* ${status}\n` +
               `📅 *Дата подачи:* ${createdDate}\n\n` +
               `📝 *Причина вступления:*\n${escapeMarkdown(application.reason)}`;
  
  // Добавляем информацию о голосовании, если заявка находится на голосовании
  if (application.status === ApplicationStatus.VOTING) {
    message += `\n\n🗳️ *Информация о голосовании:*\n` +
              `👍 За: ${application.positiveVotes}\n` +
              `👎 Против: ${application.negativeVotes}`;
    
    if (application.votingEndsAt) {
      const endsDate = new Date(application.votingEndsAt).toLocaleString('ru-RU');
      message += `\n⏱️ *Окончание голосования:* ${endsDate}`;
    }
  }
  
  // Добавляем информацию о вопросах
  if (questions.length > 0) {
    const unansweredCount = questions.filter(q => !q.answer).length;
    message += `\n\n❓ *Вопросы:* ${questions.length} (неотвеченных: ${unansweredCount})`;
  }
  
  // Создаем клавиатуру
  const keyboard = new InlineKeyboard();
  
  // Если есть вопросы, добавляем кнопку просмотра
  if (questions.length > 0) {
    keyboard.text(`📝 Просмотреть вопросы (${questions.length})`, `user_view_questions_${applicationId}`).row();
  }
  
  // Возврат к списку заявок
  keyboard.text('🔙 Вернуться к заявке', `show_application_${applicationId}`);
  keyboard.text('🔙 Главное меню', 'back_to_main');
  
  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
}));

// Обработчик для возврата к списку заявок
applicationController.callbackQuery('applications_list', handleError(async (ctx) => {
  if (!ctx.from) return;
  
  await ctx.answerCallbackQuery();
  
  const telegramId = ctx.from.id;
  const userRepository = new UserRepository();
  
  // Получаем данные пользователя
  const user = await userRepository.findByTelegramId(telegramId);
  
  if (!user) {
    await ctx.reply(
      '⚠️ Вы не зарегистрированы в системе.\n\n' +
      'Для начала работы, пожалуйста, отправьте команду /start.'
    );
    return;
  }
  
  // Получаем заявки пользователя
  const applicationRepository = new ApplicationRepository();
  const applications = await applicationRepository.findAllApplicationsByUserId(user.id);
  
  if (applications.length === 0) {
    const keyboard = await keyboardService.getMainKeyboard(user.telegramId);
    await ctx.reply(
      '⚠️ У вас нет поданных заявок.\n\n' +
      'Чтобы подать заявку на вступление, используйте команду /apply или соответствующую кнопку в главном меню.',
      { 
        reply_markup: keyboard,
        parse_mode: "Markdown"
      }
    );
    return;
  }
  
  // Формируем сообщение со списком заявок
  let message = '📋 *Ваши заявки:*\n\n';
  
  applications.forEach((app, index) => {
    const status = app.status === ApplicationStatus.PENDING ? '⏳ Ожидает рассмотрения' :
                  app.status === ApplicationStatus.VOTING ? '🗳️ На голосовании' :
                  app.status === ApplicationStatus.APPROVED ? '✅ Одобрена' :
                  app.status === ApplicationStatus.REJECTED ? '❌ Отклонена' :
                  app.status === ApplicationStatus.EXPIRED ? '⏰ Истекла' : 'Неизвестно';
    
    const createdDate = app.createdAt.toLocaleString('ru-RU');
    
    message += `*${index + 1}.* Заявка #${app.id} (${status})\n` +
               `📅 Создана: ${createdDate}\n\n`;
  });
  
  message += 'Нажмите на кнопку для просмотра подробной информации о заявке.';
  
  // Создаем клавиатуру для просмотра заявок
  const keyboard = new InlineKeyboard();
  
  applications.forEach((app, index) => {
    keyboard.text(`Заявка #${app.id}`, `show_application_${app.id}`).row();
  });
  
  keyboard.text('🔙 Главное меню', 'back_to_main');
  
  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
}));

// Обработчик для просмотра вопросов пользователем
applicationController.callbackQuery(/^user_view_questions_(\d+)$/, handleError(async (ctx) => {
  if (!ctx.from) return;
  
  await ctx.answerCallbackQuery();
  
  const applicationId = parseInt(ctx.match?.[1] || '0');
  const telegramId = ctx.from.id;
  
  // Получаем данные пользователя
  const userRepository = new UserRepository();
  const user = await userRepository.findByTelegramId(telegramId);
  
  if (!user) {
    await ctx.reply('⚠️ Вы не зарегистрированы в системе.');
    return;
  }
  
  // Получаем данные заявки
  const applicationRepository = new ApplicationRepository();
  const application = await applicationRepository.findById(applicationId);
  
  // Проверяем, принадлежит ли заявка пользователю
  if (application.userId !== user.id) {
    await ctx.reply('⚠️ Эта заявка вам не принадлежит.');
    return;
  }
  
  // Получаем вопросы к заявке
  const questionRepository = new QuestionRepository();
  const questions = await questionRepository.findByApplicationId(applicationId);
  
  if (questions.length === 0) {
    await ctx.reply(
      '⚠️ К этой заявке пока нет вопросов.',
      { 
        reply_markup: new InlineKeyboard()
          .text('🔙 Вернуться к заявке', `show_application_${applicationId}`)
      }
    );
    return;
  }
  
  // Получаем данные о задавших вопросы пользователях
  const askerIds = [...new Set(questions.map(q => q.askerId))];
  const users = await Promise.all(askerIds.map(id => userRepository.findById(id)));
  
  // Создаем карту пользователей
  const userMap: Record<number, User> = {};
  users.forEach(user => {
    if (user) {
      userMap[user.id] = user;
    }
  });
  
  // Формируем сообщение с вопросами
  let message = `📝 *Вопросы по вашей заявке #${applicationId}*\n\n`;
  
  const keyboard = new InlineKeyboard();
  
  questions.forEach((question, index) => {
    const asker = userMap[question.askerId];
    const askerName = asker ? (asker.username ? `@${escapeMarkdown(asker.username)}` : 'Администратор') : 'Неизвестный пользователь';
    
    message += `*Вопрос #${index + 1}* (от ${askerName}):\n${escapeMarkdown(question.text)}\n`;
    
    if (question.answer) {
      message += `\n*Ваш ответ:*\n${escapeMarkdown(question.answer)}\n`;
    } else {
      message += "\n*Ответ:* Не предоставлен\n";
      // Добавляем кнопку для ответа на вопрос
      keyboard.text(`Ответить на вопрос #${index + 1}`, `answer_question_${question.id}`).row();
    }
    
    if (index < questions.length - 1) {
      message += "\n---------------------\n\n";
    }
  });
  
  // Добавляем кнопку возврата
  keyboard.text('🔙 Вернуться к заявке', `show_application_${applicationId}`);
  
  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
}));

// Обработчик для кнопки ответа на вопрос
applicationController.callbackQuery(/^answer_question_(\d+)$/, handleError(async (ctx) => {
  if (!ctx.from) return;
  
  await ctx.answerCallbackQuery();
  
  const questionId = parseInt(ctx.match?.[1] || '0');
  
  // Запрашиваем у пользователя ответ на вопрос
  await ctx.reply(
    'Пожалуйста, введите ваш ответ на вопрос:',
    { parse_mode: "Markdown" }
  );
  
  // Сохраняем ID вопроса в сессии
  if (ctx.session) {
    ctx.session.step = 'waiting_question_answer';
    ctx.session.questionId = questionId;
  }
}));

// Обработчик для ответа на вопрос
applicationController.on('message:text', async (ctx, next) => {
  // Проверяем, ожидаем ли мы ответ на вопрос
  if (!ctx.session || ctx.session.step !== 'waiting_question_answer' || !ctx.session.questionId) {
    await next();
    return;
  }
  
  try {
    const questionId = ctx.session.questionId;
    const answerText = ctx.message.text;
    
    // Получаем данные вопроса
    const questionRepository = new QuestionRepository();
    const question = await questionRepository.findById(questionId);
    
    if (!question) {
      await ctx.reply(
        '⚠️ Вопрос не найден. Пожалуйста, попробуйте еще раз или вернитесь к списку заявок.',
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Получаем данные заявки
    const applicationRepository = new ApplicationRepository();
    const application = await applicationRepository.findById(question.applicationId);
    
    // Проверяем, принадлежит ли заявка пользователю
    const userRepository = new UserRepository();
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user || application.userId !== user.id) {
      await ctx.reply(
        '⚠️ У вас нет прав для ответа на этот вопрос.',
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Сохраняем ответ
    await questionRepository.answerQuestion(questionId, answerText);
    
    // Отправляем уведомление пользователю, задавшему вопрос
    const bot = getBotInstance();
    if (bot) {
      try {
        const asker = await userRepository.findById(question.askerId);
        if (asker) {
          const notificationMessage = `✅ *Получен ответ на ваш вопрос по заявке #${question.applicationId}*\n\n` +
                                    `*Ваш вопрос:* ${escapeMarkdown(question.text)}\n\n` +
                                    `*Ответ:* ${escapeMarkdown(answerText)}`;
          
          await bot.api.sendMessage(asker.telegramId, notificationMessage, {
            parse_mode: "Markdown"
          });
        }
      } catch (error) {
        logger.error(`Не удалось отправить уведомление о ответе на вопрос: ${error}`);
      }
    }
    
    // Отправляем сообщение об успешном ответе
    const keyboard = new InlineKeyboard()
      .text('🔙 Вернуться к вопросам', `user_view_questions_${question.applicationId}`)
      .row()
      .text('🔙 Вернуться к заявке', `show_application_${question.applicationId}`);
    
    await ctx.reply(
      '✅ Ваш ответ на вопрос успешно сохранен и отправлен администратору!',
      { reply_markup: keyboard, parse_mode: "Markdown" }
    );
    
    // Сбрасываем состояние
    ctx.session.step = undefined;
    ctx.session.questionId = undefined;
    
  } catch (error) {
    logger.error(`Ошибка при ответе на вопрос: ${error}`);
    await ctx.reply(
      '⚠️ Произошла ошибка при сохранении ответа. Пожалуйста, попробуйте позже.',
      { parse_mode: "Markdown" }
    );
    
    // Сбрасываем состояние
    if (ctx.session) {
      ctx.session.step = undefined;
      ctx.session.questionId = undefined;
    }
  }
});

export { applicationController };