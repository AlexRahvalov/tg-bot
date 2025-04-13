import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { type BotCommand } from '@grammyjs/types';
import { Keyboard } from 'grammy';
import dotenv from 'dotenv';
import { ApplicationController } from './controllers/application.controller';
import { AdminController } from './controllers/admin.controller';
import { ProfileController } from './controllers/profile.controller';
import { QuestionsController } from './controllers/questions.controller';
import { RoleController } from './controllers/role.controller';
import { runMigration } from './database/migration';
import { ErrorHandlerService } from './services/error-handler.service';
import { NotificationService } from './services/notification.service';
import { ApplicationService } from './services/application.service';
import { ApplicationStatus } from './models/application.model';
import { KeyboardService, MenuContext } from './services/keyboard.service';
import { UserModel, UserRole } from './models/user.model';
import { ReputationService } from './services/reputation.service';
import { KeyboardFactory } from './services/keyboard.factory';

// Загрузка переменных окружения
dotenv.config();

// Определение типа сессии
interface SessionData {
  // Здесь будут данные сессии для заполнения заявки
  applyStep?: number;
  minecraftUsername?: string;
  applicationReason?: string;
  // Данные сессии для административных функций
  adminAction?: string;
  adminTargetId?: number;
  // Данные сессии для профиля
  profileAction?: string;
  // Данные сессии для вопросов к заявкам
  askQuestionApplicationId?: number;
  answerQuestionApplicationId?: number;
  answerToUserId?: number;
  // Данные для системы меню
  menuContext?: MenuContext;     // Текущий контекст меню
  previousContext?: MenuContext; // Предыдущий контекст (для кнопки "Назад")
}

// Расширенный тип контекста с сессией
type MyContext = Context & SessionFlavor<SessionData>;

// Проверка наличия токена
if (!process.env.BOT_TOKEN) {
  console.error('Ошибка: Токен бота не найден в переменных окружения');
  process.exit(1);
}

// Создание экземпляра бота
const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

// Инициализация сервисов
const notificationService = new NotificationService(bot as unknown as Bot);
const keyboardService = new KeyboardService(bot as unknown as Bot);
const roleController = new RoleController(bot as unknown as Bot);
const applicationService = new ApplicationService(notificationService, keyboardService, roleController);

// Контроллеры
const applicationController = new ApplicationController(bot, applicationService, notificationService);
const adminController = new AdminController(applicationService, undefined, notificationService);
const profileController = new ProfileController();
const questionsController = new QuestionsController(bot, applicationService, notificationService);

// Настройка сессии - используем простое хранилище в памяти
// для продакшн лучше использовать redis или другое постоянное хранилище
bot.use(session({
  initial: () => ({} as SessionData)
}));

// Обработчик команды /start с добавлением постоянной клавиатуры
bot.command('start', async (ctx) => {
  try {
    // Создаем или получаем пользователя с ролью NEW
    const user = await roleController.setNewUserRole(ctx);
    
    if (!user) {
      await ctx.reply('Произошла ошибка при регистрации. Пожалуйста, попробуйте еще раз.');
      return;
    }
    
    let welcomeMessage = 'Привет! Это бот для доступа к Minecraft-серверу.';
    
    // Устанавливаем контекст главного меню
    ctx.session.menuContext = MenuContext.MAIN;
    ctx.session.previousContext = undefined;
    
    // Формируем приветственное сообщение в зависимости от роли
    switch (user.role) {
      case UserRole.NEW:
        welcomeMessage += '\n\nДля начала работы с сервером вам нужно подать заявку на вступление.';
        break;
      case UserRole.GUEST:
        welcomeMessage += '\n\nВаша заявка находится на рассмотрении. Вы можете проверить её статус.';
        break;
      case UserRole.MEMBER:
        welcomeMessage += '\n\nВы полноценный участник сообщества. Выберите действие:';
        break;
      case UserRole.ADMIN:
        welcomeMessage += '\n\nВы администратор сервера. Выберите действие:';
        break;
    }
    
    // Получаем клавиатуры в зависимости от роли пользователя
    const inlineKeyboard = keyboardService.getInlineKeyboardByContext(user.role, MenuContext.MAIN);
    const replyKeyboard = keyboardService.getKeyboardByContext(user.role, MenuContext.MAIN);
    
    // Отправляем сообщение с инлайн-клавиатурой
    await ctx.reply(
      welcomeMessage,
      { 
        reply_markup: inlineKeyboard
      }
    );
    
    // Отправляем второе сообщение с постоянной клавиатурой
    await ctx.reply('Также вы можете использовать клавиатуру снизу для быстрого доступа:', {
      reply_markup: replyKeyboard
    });
  } catch (error) {
    console.error('Ошибка при обработке команды start:', error);
    await ctx.reply('Произошла ошибка при запуске бота. Пожалуйста, попробуйте еще раз позже.');
  }
});

// Обработчики для текстовых кнопок с клавиатуры
bot.hears("🚪 Подать заявку", (ctx) => applicationController.startApply(ctx));
bot.hears("📋 Проверить статус", (ctx) => applicationController.checkStatus(ctx));

// Обработчик для профиля
bot.hears("👤 Профиль", async (ctx) => {
  await handleNavigation(ctx, MenuContext.PROFILE);
});

// Обработчик для заявок (участники и админы)
bot.hears("👥 Заявки", async (ctx) => {
  await handleNavigation(ctx, MenuContext.APPLICATIONS);
});

// Обработчик для списка пользователей (участники и админы)
bot.hears("👤 Пользователи", async (ctx) => {
  await handleNavigation(ctx, MenuContext.USERS);
});

// Обработчик для помощи
bot.hears("❓ Помощь", async (ctx) => {
  await handleNavigation(ctx, MenuContext.HELP);
});

// Обработчики для текстовых кнопок с админской клавиатуры
bot.hears("👥 Заявки", async (ctx) => {
  await handleNavigation(ctx, MenuContext.ADMIN_APPS);
});

bot.hears("📊 Статистика", async (ctx) => {
  await handleNavigation(ctx, MenuContext.ADMIN_STATS);
});

bot.hears("🔄 Проверить соединение", (ctx) => adminController.testServerConnection(ctx));

bot.hears("⚙️ Настройки", async (ctx) => {
  await ctx.reply("Настройки пока недоступны. Функционал в разработке.", {
    reply_markup: new InlineKeyboard().text("Назад", "admin")
  });
});

bot.hears("🔙 Основное меню", async (ctx) => {
  // Сбрасываем контекст и возвращаемся в главное меню
  ctx.session.menuContext = MenuContext.MAIN;
  ctx.session.previousContext = undefined;
  
  // Получаем данные о пользователе
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  // Получаем клавиатуры для главного меню
  const inlineKeyboard = keyboardService.getInlineKeyboardByContext(user.role, MenuContext.MAIN);
  const replyKeyboard = keyboardService.getKeyboardByContext(user.role, MenuContext.MAIN);
  
  // Отправляем сообщение с основным меню
  await ctx.reply('Возвращаемся в основное меню', {
    reply_markup: replyKeyboard
  });
  
  await ctx.reply('Выберите действие:', {
    reply_markup: inlineKeyboard
  });
});

// Обработчик команды /help
bot.command('help', async (ctx) => {
  await handleNavigation(ctx, MenuContext.HELP);
});

// Команды для обычных пользователей
bot.command('apply', (ctx) => applicationController.startApply(ctx));
bot.command('status', (ctx) => applicationController.checkStatus(ctx));

// Обновленная команда профиля
bot.command('profile', async (ctx) => {
  await handleNavigation(ctx, MenuContext.PROFILE);
});

// Добавляем команду для доступа к списку пользователей
bot.command('users', async (ctx) => {
  // Получаем данные о пользователе
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  // Проверяем права доступа (только для MEMBER и ADMIN)
  if (user.role !== UserRole.MEMBER && user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для просмотра списка пользователей.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.USERS);
});

// Команды для администраторов
bot.command('admin', async (ctx) => {
  // Получаем данные о пользователе
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  // Проверяем права доступа (только для ADMIN)
  if (user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_PANEL);
});

// Остальные админские команды используют контекстное меню
bot.command('admin_applications', async (ctx) => {
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_APPS);
});

bot.command('admin_users', async (ctx) => {
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_USERS);
});

bot.command('admin_stats', async (ctx) => {
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_STATS);
});

// Обработка команд управления заявкой
bot.hears(/^\/admin_app_(\d+)$/, (ctx) => {
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminManageApplication(ctx, applicationId);
  }
});

// Обработка команд изменения статуса заявки
bot.hears(/^\/admin_approve_(\d+)$/, (ctx) => {
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminApproveApplication(ctx, applicationId);
  }
});

bot.hears(/^\/admin_reject_(\d+)$/, (ctx) => {
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminRejectApplication(ctx, applicationId);
  }
});

bot.hears(/^\/admin_ban_(\d+)$/, (ctx) => {
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminBanApplication(ctx, applicationId);
  }
});

// Хелпер-функция для безопасного ответа на колбэк-запросы
async function safeAnswerCallback(ctx: MyContext, text: string = "") {
  try {
    await ctx.answerCallbackQuery(text);
  } catch (error) {
    // Ошибку игнорируем, так как она уже будет перехвачена глобальным обработчиком
    // Но мы можем добавить логирование для отладки
    console.log(`Не удалось ответить на колбэк: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Обработка колбэков от инлайн-кнопок
bot.callbackQuery("apply", async (ctx) => {
  await safeAnswerCallback(ctx);
  applicationController.startApply(ctx);
});

bot.callbackQuery("status", async (ctx) => {
  await safeAnswerCallback(ctx);
  applicationController.checkStatus(ctx);
});

bot.callbackQuery("help", async (ctx) => {
  await safeAnswerCallback(ctx);
  ctx.reply(
    'Список доступных команд:\n\n' +
    '/start - Начать работу с ботом\n' +
    '/apply - Подать заявку на вступление в сервер\n' +
    '/status - Проверить статус вашей заявки\n' +
    '/help - Показать эту справку',
    { 
      reply_markup: new InlineKeyboard()
        .text("Подать заявку", "apply")
        .text("Проверить статус", "status")
        .row()
        .text("На главную", "start")
    }
  );
});

bot.callbackQuery("start", async (ctx) => {
  await safeAnswerCallback(ctx);
  const keyboard = new InlineKeyboard()
    .text("Подать заявку", "apply")
    .text("Проверить статус", "status")
    .row()
    .text("Помощь", "help");

  ctx.reply(
    'Привет! Это бот для доступа к Minecraft-серверу. \n\n' +
    'Используйте кнопки ниже для взаимодействия с ботом:',
    { reply_markup: keyboard }
  );
});

// Обработчик текстовых сообщений для процесса заполнения заявки и редактирования профиля
bot.on('message:text', async (ctx) => {
  // Проверяем сначала для заполнения заявки
  if (ctx.session.applyStep) {
    await applicationController.processApplyStep(ctx);
    return;
  }
  
  // Проверяем для редактирования профиля
  if (ctx.session.profileAction) {
    await profileController.processProfileEditing(ctx);
    return;
  }
  
  // Проверяем для ввода вопроса к заявке
  if (ctx.session.askQuestionApplicationId) {
    await questionsController.processQuestion(ctx);
    return;
  }

  // Проверяем для ввода ответа на вопрос
  if (ctx.session.answerQuestionApplicationId && ctx.session.answerToUserId) {
    // Получаем текст ответа
    if (ctx.message && 'text' in ctx.message) {
      const answer = ctx.message.text?.trim() || '';
      
      // Получаем ID заявки и ID автора вопроса из сессии
      const applicationId = ctx.session.answerQuestionApplicationId;
      const fromUserId = ctx.session.answerToUserId;
      
      // Обрабатываем ответ через контроллер вопросов
      await questionsController.processAnswer(ctx, applicationId, fromUserId, answer);
      return;
    }
    return;
  }
});

// Обработка колбэков от инлайн-кнопок для админских функций
bot.callbackQuery("admin", async (ctx) => {
  await safeAnswerCallback(ctx);
  adminController.adminPanel(ctx);
});

bot.callbackQuery("admin_applications", async (ctx) => {
  await safeAnswerCallback(ctx);
  adminController.adminApplications(ctx);
});

bot.callbackQuery("admin_users", async (ctx) => {
  await safeAnswerCallback(ctx);
  adminController.adminUsers(ctx);
});

bot.callbackQuery("admin_stats", async (ctx) => {
  await safeAnswerCallback(ctx);
  adminController.adminStats(ctx);
});

bot.callbackQuery("admin_test", async (ctx) => {
  await safeAnswerCallback(ctx);
  adminController.testServerConnection(ctx);
});

// Обработка колбэков для управления конкретной заявкой
bot.callbackQuery(/^admin_app_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminManageApplication(ctx, applicationId);
  }
});

// Обработка колбэков для действий с заявкой
bot.callbackQuery(/^admin_approve_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminApproveApplication(ctx, applicationId);
  }
});

bot.callbackQuery(/^admin_reject_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminRejectApplication(ctx, applicationId);
  }
});

bot.callbackQuery(/^admin_ban_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    adminController.adminBanApplication(ctx, applicationId);
  }
});

// Обработка колбэков для голосования за заявки
bot.callbackQuery(/^vote_yes_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx, "Ваш голос 'За' учтен!");
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    applicationController.voteForApplication(ctx, applicationId, true);
  }
});

bot.callbackQuery(/^vote_no_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx, "Ваш голос 'Против' учтен!");
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    applicationController.voteForApplication(ctx, applicationId, false);
  }
});

bot.callbackQuery(/^ask_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  if (!isNaN(applicationId)) {
    questionsController.askQuestionToApplicant(ctx, applicationId);
  }
});

// Обработка ответа на вопрос
bot.callbackQuery(/^answer_(\d+)_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx);
  const applicationId = parseInt(ctx.match[1]);
  const fromUserId = parseInt(ctx.match[2]);
  if (!isNaN(applicationId) && !isNaN(fromUserId)) {
    // Устанавливаем состояние для ответа на вопрос
    ctx.session.answerQuestionApplicationId = applicationId;
    ctx.session.answerToUserId = fromUserId;
    // Просим пользователя ввести ответ
    await ctx.reply(
      'Пожалуйста, напишите ваш ответ на вопрос:',
      {
        reply_markup: new InlineKeyboard().text("Отменить", "cancel_answer")
      }
    );
  }
});

// Обработка отмены ответа на вопрос
bot.callbackQuery("cancel_answer", async (ctx) => {
  await safeAnswerCallback(ctx, "Отправка ответа отменена");
  questionsController.cancelAnswer(ctx);
});

// Обработка отмены вопроса
bot.callbackQuery("cancel_question", async (ctx) => {
  await safeAnswerCallback(ctx, "Отправка вопроса отменена");
  questionsController.cancelQuestion(ctx);
});

// Обработка кнопки отмены заполнения заявки
bot.callbackQuery("cancel_apply", async (ctx) => {
  await safeAnswerCallback(ctx, "Заявка отменена");
  applicationController.cancelApply(ctx);
});

// Обработчики для навигационных callback-запросов
bot.callbackQuery("main_menu", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Сбрасываем контекст и переходим в главное меню
  ctx.session.menuContext = MenuContext.MAIN;
  ctx.session.previousContext = undefined;
  
  // Получаем данные о пользователе
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  // Получаем клавиатуру для главного меню
  const inlineKeyboard = keyboardService.getInlineKeyboardByContext(user.role, MenuContext.MAIN);
  
  await ctx.reply('Главное меню:', {
    reply_markup: inlineKeyboard
  });
});

bot.callbackQuery("back", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Переходим к предыдущему контексту, если он есть
  if (ctx.session.previousContext) {
    await handleNavigation(ctx, ctx.session.previousContext);
  } else {
    // Если предыдущего контекста нет, возвращаемся в главное меню
    ctx.session.menuContext = MenuContext.MAIN;
    
    // Получаем данные о пользователе
    const user = await UserModel.getByTelegramId(ctx.from!.id);
    if (!user) return;
    
    // Получаем клавиатуру для главного меню
    const inlineKeyboard = keyboardService.getInlineKeyboardByContext(user.role, MenuContext.MAIN);
    
    await ctx.reply('Главное меню:', {
      reply_markup: inlineKeyboard
    });
  }
});

// Обработчики для профиля
bot.callbackQuery("profile", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Переходим в контекст профиля
  await handleNavigation(ctx, MenuContext.PROFILE);
});

bot.callbackQuery("profile_applications", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Показываем историю заявок пользователя
  profileController.showApplicationHistory(ctx);
});

bot.callbackQuery("profile_votes", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Показываем историю голосований пользователя
  profileController.showVotingHistory(ctx);
});

bot.callbackQuery("profile_reputation", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Получаем данные о пользователе
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  // Получаем репутационный сервис
  const reputationService = new ReputationService(notificationService);
  
  // Получаем данные о репутации
  const reputation = await reputationService.getUserReputationStats(user.telegramId);
  
  if (reputation) {
    // Формируем сообщение с данными о репутации
    let message = '📊 *Ваша репутация*\n\n';
    message += `👍 Положительные оценки: ${reputation.positive}\n`;
    message += `👎 Отрицательные оценки: ${reputation.negative}\n`;
    message += `📊 Процент негативных оценок: ${Math.round(reputation.negativePercent)}%\n`;
    message += `⚠️ Порог исключения: ${reputation.threshold}%\n\n`;
    
    if (reputation.negativePercent >= reputation.threshold) {
      message += '⚠️ *Внимание!* Ваша негативная репутация превысила порог исключения. Вы можете быть исключены из белого списка автоматически.\n\n';
    }
    
    message += 'Чтобы увидеть детальную статистику своей репутации, обратитесь к администратору.';
    
    // Отправляем сообщение
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboardService.getInlineKeyboardByContext(user.role, MenuContext.PROFILE)
    });
  } else {
    await ctx.reply('Не удалось получить данные о репутации.', {
      reply_markup: keyboardService.getInlineKeyboardByContext(user.role, MenuContext.PROFILE)
    });
  }
});

// Обработчики для списка пользователей
bot.callbackQuery("users_all", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Показываем список всех пользователей
  // Здесь будет вызов метода для отображения списка пользователей
  // Пока используем существующий метод из AdminController
  adminController.adminUsers(ctx);
});

bot.callbackQuery("users_members", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Показываем список участников
  // Здесь будет вызов метода для отображения списка участников
  // Пока заглушка
  await ctx.reply('Список участников будет доступен в ближайшее время.', {
    reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
  });
});

bot.callbackQuery("users_search", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Показываем форму для поиска пользователей
  // Пока заглушка
  await ctx.reply('Поиск пользователей будет доступен в ближайшее время.', {
    reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
  });
});

// Обработчики для голосования по репутации
bot.callbackQuery(/^vote_positive_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx, "Голосование...");
  
  const userId = parseInt(ctx.match[1]);
  if (!isNaN(userId)) {
    // Получаем данные о целевом пользователе
    const targetUser = await UserModel.getById(userId);
    if (!targetUser) {
      await ctx.reply('Пользователь не найден.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
      });
      return;
    }
    
    // Получаем данные о голосующем пользователе
    const voter = await UserModel.getByTelegramId(ctx.from!.id);
    if (!voter) return;
    
    // Получаем репутационный сервис
    const reputationService = new ReputationService(notificationService);
    
    // Голосуем положительно
    const result = await reputationService.voteForUser(voter.telegramId, targetUser.telegramId, true);
    
    if (result) {
      await ctx.reply(`Вы успешно проголосовали положительно за пользователя ${targetUser.firstName} ${targetUser.lastName || ''}.`, {
        reply_markup: keyboardService.getInlineKeyboardByContext(voter.role, MenuContext.USERS)
      });
    } else {
      await ctx.reply('Не удалось проголосовать. Возможно, вы уже голосовали за этого пользователя.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(voter.role, MenuContext.USERS)
      });
    }
  }
});

bot.callbackQuery(/^vote_negative_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx, "Выберите причину...");
  
  const userId = parseInt(ctx.match[1]);
  if (!isNaN(userId)) {
    // Получаем данные о целевом пользователе
    const targetUser = await UserModel.getById(userId);
    if (!targetUser) {
      await ctx.reply('Пользователь не найден.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
      });
      return;
    }
    
    // Получаем причины для отрицательного голосования
    const reputationService = new ReputationService(notificationService);
    const reasons = await reputationService.getReputationReasons(false);
    
    if (reasons && reasons.length > 0) {
      // Создаем клавиатуру с причинами
      const keyboard = new InlineKeyboard();
      
      for (const reason of reasons) {
        keyboard.text(reason.name, `vote_negative_reason_${userId}_${reason.id}`).row();
      }
      
      // Добавляем кнопку отмены
      keyboard.text("Отменить", "users_all");
      
      await ctx.reply('Выберите причину отрицательной оценки:', {
        reply_markup: keyboard
      });
    } else {
      await ctx.reply('Не удалось получить список причин для отрицательной оценки.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
      });
    }
  }
});

bot.callbackQuery(/^vote_negative_reason_(\d+)_(\d+)$/, async (ctx) => {
  await safeAnswerCallback(ctx, "Голосование...");
  
  const userId = parseInt(ctx.match[1]);
  const reasonId = parseInt(ctx.match[2]);
  
  if (!isNaN(userId) && !isNaN(reasonId)) {
    // Получаем данные о целевом пользователе
    const targetUser = await UserModel.getById(userId);
    if (!targetUser) {
      await ctx.reply('Пользователь не найден.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.USERS)
      });
      return;
    }
    
    // Получаем данные о голосующем пользователе
    const voter = await UserModel.getByTelegramId(ctx.from!.id);
    if (!voter) return;
    
    // Получаем репутационный сервис
    const reputationService = new ReputationService(notificationService);
    
    // Голосуем отрицательно с указанием причины
    const result = await reputationService.voteForUser(
      voter.telegramId, 
      targetUser.telegramId, 
      false, 
      reasonId
    );
    
    if (result) {
      await ctx.reply(`Вы успешно проголосовали отрицательно за пользователя ${targetUser.firstName} ${targetUser.lastName || ''}.`, {
        reply_markup: keyboardService.getInlineKeyboardByContext(voter.role, MenuContext.USERS)
      });
    } else {
      await ctx.reply('Не удалось проголосовать. Возможно, вы уже голосовали за этого пользователя.', {
        reply_markup: keyboardService.getInlineKeyboardByContext(voter.role, MenuContext.USERS)
      });
    }
  }
});

// Обработчики для заявок
bot.callbackQuery("applications_all", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Проверяем права доступа
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user) return;
  
  if (user.role === UserRole.ADMIN) {
    // Для админов показываем все заявки
    adminController.adminApplications(ctx);
  } else if (user.role === UserRole.MEMBER) {
    // Для обычных пользователей ограниченный список
    // Используем существующую функцию, но нужно будет создать отдельную для обычных пользователей
    adminController.adminApplications(ctx);
  } else {
    await ctx.reply('У вас нет прав для просмотра всех заявок.');
  }
});

bot.callbackQuery("applications_pending", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Здесь будет логика показа активных заявок
  // Пока используем заглушку
  await ctx.reply('Активные заявки будут доступны в ближайшее время.', {
    reply_markup: keyboardService.getInlineKeyboardByContext(UserRole.MEMBER, MenuContext.APPLICATIONS)
  });
});

// Обработчики для административной панели
bot.callbackQuery("admin", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_PANEL);
});

bot.callbackQuery("admin_applications", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_APPS);
});

bot.callbackQuery("admin_users", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_USERS);
});

bot.callbackQuery("admin_stats", async (ctx) => {
  await safeAnswerCallback(ctx);
  
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  await handleNavigation(ctx, MenuContext.ADMIN_STATS);
});

// Обработчик для обновления статистики
bot.callbackQuery("admin_stats_refresh", async (ctx) => {
  await safeAnswerCallback(ctx, "Обновление...");
  
  // Проверяем права администратора
  const user = await UserModel.getByTelegramId(ctx.from!.id);
  if (!user || user.role !== UserRole.ADMIN) {
    await ctx.reply('У вас нет прав для доступа к панели администратора.');
    return;
  }
  
  // Показываем обновленную статистику
  adminController.adminStats(ctx);
});

// Хелпер-функция для обработки навигации между разделами
async function handleNavigation(ctx: MyContext, newContext: MenuContext, params?: any): Promise<void> {
  try {
    // Получаем данные пользователя
    const user = await UserModel.getByTelegramId(ctx.from!.id);
    if (!user) return;
    
    // Сохраняем предыдущий контекст
    ctx.session.previousContext = ctx.session.menuContext;
    
    // Устанавливаем новый контекст
    ctx.session.menuContext = newContext;
    
    // Формируем сообщение в зависимости от контекста
    let message = 'Выберите действие:';
    
    switch (newContext) {
      case MenuContext.PROFILE:
        message = '👤 *Профиль пользователя*\n\nВыберите действие:';
        break;
      case MenuContext.USERS:
        message = '👥 *Список пользователей*\n\nВыберите действие:';
        break;
      case MenuContext.APPLICATIONS:
        message = '📋 *Заявки*\n\nВыберите действие:';
        break;
      case MenuContext.ADMIN_PANEL:
        message = '⚙️ *Панель администратора*\n\nВыберите действие:';
        break;
      case MenuContext.HELP:
        message = '❓ *Справка*\n\nВыберите раздел:';
        break;
    }
    
    // Получаем клавиатуру для текущего контекста
    const inlineKeyboard = keyboardService.getInlineKeyboardByContext(user.role, newContext, params);
    
    // Отправляем сообщение с новым меню
    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard 
    });
  } catch (error) {
    console.error('Ошибка при обработке навигации:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
}

// Функция для инициализации бота
async function startBot() {
  try {
    // Выполнение миграции базы данных
    console.log('Запуск миграции базы данных...');
    await runMigration();
    
    // Настройка глобальных команд бота
    await keyboardService.setGlobalCommands();
    
    // Настройка обработчика ошибок
    // Используем .catch() для перехвата и обработки ошибок
    bot.catch((err) => {
      ErrorHandlerService.handleBotError(err);
    });
    
    // Установка планировщика для проверки заявок с истекшим сроком голосования
    setInterval(async () => {
      try {
        console.log('Проверка заявок с истекшим сроком голосования...');
        const expiredApplications = await applicationService.checkExpiredApplications();
        console.log(`Обработано ${expiredApplications} заявок с истекшим сроком голосования`);
      } catch (error) {
        console.error('Ошибка при проверке заявок с истекшим сроком голосования:', error);
      }
    }, 60000); // Проверка каждую минуту (60000 мс)
    
    // Запуск бота
    console.log('Запуск бота...');
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Бот @${botInfo.username} успешно запущен!`);
      },
    });
  } catch (error) {
    console.error('Ошибка при запуске бота:', error);
    process.exit(1);
  }
}

// Запуск бота при запуске файла
if (require.main === module) {
  // Настройка глобальных обработчиков ошибок
  ErrorHandlerService.setupGlobalErrorHandlers();
  // Запуск бота
  startBot();
}

// Обработка необработанных ошибок убрана, так как теперь они обрабатываются в ErrorHandlerService 