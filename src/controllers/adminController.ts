import { Composer, InlineKeyboard } from 'grammy';
import type { MyContext } from '../index';
import { keyboardService } from '../services/keyboardService';
import { handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { ApplicationRepository } from '../db/repositories/applicationRepository';
import { SystemSettingsRepository } from '../db/repositories/systemSettingsRepository';
import { UserRole, ApplicationStatus } from '../models/types';
import { messageService } from '../services/messageService';
import { logger } from '../utils/logger';
import { getBotInstance } from '../controllers/applicationController';

// Создаем репозитории
const userRepository = new UserRepository();
const applicationRepository = new ApplicationRepository();
const systemSettingsRepository = new SystemSettingsRepository();

// Создаем композер для админ-команд
const adminController = new Composer<MyContext>();

// Проверка прав администратора (middleware)
const adminMiddleware = async (ctx: MyContext, next: () => Promise<void>) => {
  try {
    if (!ctx.from) {
      return await ctx.reply("⚠️ Не удалось определить пользователя.");
    }

    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user || user.role !== UserRole.ADMIN) {
      return await ctx.reply("⚠️ У вас нет прав доступа к этой функции.");
    }
    
    await next();
  } catch (error) {
    await handleErrorWithContext(ctx, error, "adminMiddleware");
  }
};

// Применяем middleware ко всем обработчикам в этом композере
adminController.use(adminMiddleware);

// Обработка callback-запросов для админ-панели
adminController.callbackQuery("admin_users", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const users = await userRepository.findAllMembers();
    
    if (users.length === 0) {
      await ctx.reply("👥 Активных участников не найдено.");
      return;
    }
    
    let message = "👥 *Список участников сервера:*\n\n";
    
    for (const user of users) {
      const userInfo = `👤 *${user.minecraftNickname}*${user.username ? ` (@${user.username})` : ''}\n` +
                      `Репутация: ${user.reputation > 0 ? '👍 ' : ''}${user.reputation < 0 ? '👎 ' : ''}${user.reputation}\n` +
                      `Право голоса: ${user.canVote ? '✅' : '❌'}\n\n`;
      
      message += userInfo;
    }
    
    await ctx.reply(message, { parse_mode: "Markdown" });
    
    const keyboard = new InlineKeyboard()
      .text("🔙 Назад", "admin_back_to_main");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "adminUsersList");
  }
});

// Обработка запроса на управление заявками
adminController.callbackQuery("admin_applications", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const applications = await applicationRepository.findVotingApplications();
    
    if (applications.length === 0) {
      await ctx.reply("📝 Нет заявок, ожидающих рассмотрения.");
      
      const keyboard = new InlineKeyboard()
        .text("🔙 Назад", "admin_back_to_main");
      
      await ctx.reply("Выберите действие:", { reply_markup: keyboard });
      return;
    }
    
    let message = "📝 *Заявки, ожидающие рассмотрения:*\n\n";
    
    for (const application of applications) {
      const user = await userRepository.findById(application.userId);
      
      const applicationInfo = `#${application.id} - ${application.minecraftNickname}${user.username ? ` (@${user.username})` : ''}\n` +
                              `Статус: ${application.status === ApplicationStatus.PENDING ? '⏳ Ожидает' : 
                                        application.status === ApplicationStatus.VOTING ? '🗳️ Голосование' : 
                                        application.status === ApplicationStatus.APPROVED ? '✅ Одобрена' : 
                                        application.status === ApplicationStatus.REJECTED ? '❌ Отклонена' : 
                                        application.status === ApplicationStatus.EXPIRED ? '⏰ Истекла' : 
                                        '❓ Неизвестно'}\n\n`;
      
      message += applicationInfo;
      
      // Создаем клавиатуру с действиями для заявки
      const keyboard = new InlineKeyboard()
        .text("📝 Детали", `app_view_${application.id}`).row()
        .text("✅ Принять", `app_approve_${application.id}`)
        .text("❌ Отклонить", `app_reject_${application.id}`).row()
        .text("🗳️ Голосование", `app_start_voting_${application.id}`).row();
      
      await ctx.reply(`Заявка #${application.id} от ${application.minecraftNickname}:`, { reply_markup: keyboard });
    }
    
    const backKeyboard = new InlineKeyboard()
      .text("🔙 Назад", "admin_back_to_main");
    
    await ctx.reply("Вернуться в главное меню:", { reply_markup: backKeyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "adminApplicationsList");
  }
});

// Обработка запроса на настройки
adminController.callbackQuery("admin_settings", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const settings = await systemSettingsRepository.getSettings();
    
    const message = "⚙️ *Настройки сервера:*\n\n" +
                    `*Продолжительность голосования:* ${messageService.formatDuration(
                      settings.votingDurationDays,
                      settings.votingDurationHours,
                      settings.votingDurationMinutes
                    )}\n` +
                    `*Минимальное кол-во голосов:* ${settings.minVotesRequired}\n` +
                    `*Порог отриц. оценок:* ${settings.negativeRatingsThreshold}`;
    
    // Создаем клавиатуру для настроек
    const keyboard = new InlineKeyboard()
      .text("⏱️ Длительность голосования", "settings_voting_duration").row()
      .text("🔢 Мин. кол-во голосов", "settings_min_votes").row()
      .text("👎 Порог отриц. оценок", "settings_neg_threshold").row()
      .text("🔙 Назад", "admin_back_to_main").row();
    
    await ctx.reply(message, { 
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "adminSettings");
  }
});

// Обработка настройки длительности голосования
adminController.callbackQuery("settings_voting_duration", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const settings = await systemSettingsRepository.getSettings();
    
    // Сохраним настройки в сессии для редактирования
    if (ctx.session) {
      ctx.session.votingSettings = {
        days: settings.votingDurationDays,
        hours: settings.votingDurationHours,
        minutes: settings.votingDurationMinutes
      };
    }
    
    const keyboard = keyboardService.getVotingSettingsKeyboard(
      settings.votingDurationDays,
      settings.votingDurationHours,
      settings.votingDurationMinutes
    );
    
    await ctx.reply(
      "⏱️ *Настройка длительности голосования*\n\n" +
      "Используйте кнопки для изменения значений:",
      { 
        reply_markup: keyboard,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "settingsVotingDuration");
  }
});

// Возвращение в главное меню администратора
adminController.callbackQuery("admin_back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const keyboard = keyboardService.getAdminPanelKeyboard();
    
    await ctx.editMessageText(
      "🛠️ Панель администратора\n\n" +
      "Выберите раздел для управления:",
      { 
        reply_markup: keyboard
      }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "adminBackToMain");
  }
});

// Обработка изменения дней голосования
adminController.callbackQuery(/^voting_days_(plus|minus)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Инициализируем настройки, если их нет
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.votingSettings) {
      ctx.session.votingSettings = { days: 1, hours: 0, minutes: 0 };
    }
    
    const action = ctx.match[1];
    
    if (action === 'plus' && ctx.session.votingSettings.days < 30) {
      ctx.session.votingSettings.days++;
    } else if (action === 'minus' && ctx.session.votingSettings.days > 0) {
      ctx.session.votingSettings.days--;
    }
    
    await updateVotingTimeMessage(ctx);
  } catch (error) {
    await handleErrorWithContext(ctx, error, "votingDaysUpdate");
  }
});

// Обработка изменения часов голосования
adminController.callbackQuery(/^voting_hours_(plus|minus)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Инициализируем настройки, если их нет
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.votingSettings) {
      ctx.session.votingSettings = { days: 0, hours: 12, minutes: 0 };
    }
    
    const action = ctx.match[1];
    
    if (action === 'plus' && ctx.session.votingSettings.hours < 23) {
      ctx.session.votingSettings.hours++;
    } else if (action === 'minus' && ctx.session.votingSettings.hours > 0) {
      ctx.session.votingSettings.hours--;
    }
    
    await updateVotingTimeMessage(ctx);
  } catch (error) {
    await handleErrorWithContext(ctx, error, "votingHoursUpdate");
  }
});

// Обработка изменения минут голосования
adminController.callbackQuery(/^voting_minutes_(plus|minus)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Инициализируем настройки, если их нет
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.votingSettings) {
      ctx.session.votingSettings = { days: 0, hours: 0, minutes: 30 };
    }
    
    const action = ctx.match[1];
    
    if (action === 'plus' && ctx.session.votingSettings.minutes < 59) {
      ctx.session.votingSettings.minutes++;
    } else if (action === 'minus' && ctx.session.votingSettings.minutes > 0) {
      ctx.session.votingSettings.minutes--;
    }
    
    await updateVotingTimeMessage(ctx);
  } catch (error) {
    await handleErrorWithContext(ctx, error, "votingMinutesUpdate");
  }
});

// Сохранение настроек времени голосования
adminController.callbackQuery("voting_time_save", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.session?.votingSettings) {
      await ctx.reply("❌ Ошибка: настройки не найдены.");
      return;
    }
    
    const { days, hours, minutes } = ctx.session.votingSettings;
    
    // Проверяем, что хотя бы одно значение больше нуля
    if (days === 0 && hours === 0 && minutes === 0) {
      await ctx.reply("⚠️ Время голосования не может быть нулевым.");
      return;
    }
    
    // Сохраняем настройки
    await systemSettingsRepository.updateVotingDuration(days, hours, minutes);
    
    await ctx.reply(
      "✅ Настройки времени голосования сохранены:\n\n" +
      `Новая длительность: ${messageService.formatDuration(days, hours, minutes)}`
    );
    
    // Возвращаемся в меню настроек
    const keyboard = new InlineKeyboard()
      .text("🔙 Назад к настройкам", "admin_settings");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "votingSaveSettings");
  }
});

// Возврат к настройкам из меню редактирования времени
adminController.callbackQuery("voting_back", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Возвращаемся в меню настроек
    await ctx.editMessageText(
      "⚙️ Загрузка настроек...",
      { reply_markup: { inline_keyboard: [] } }
    );
    
    // Вызываем обработчик настроек
    await adminController.middleware()(
      { ...ctx, callbackQuery: { data: "admin_settings" } } as any,
      async () => {}
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "votingBackToSettings");
  }
});

// Вспомогательная функция для обновления сообщения с настройками времени
async function updateVotingTimeMessage(ctx: MyContext) {
  try {
    if (!ctx.session?.votingSettings) return;
    
    const { days, hours, minutes } = ctx.session.votingSettings;
    
    const keyboard = keyboardService.getVotingSettingsKeyboard(days, hours, minutes);
    
    const formattedDuration = messageService.formatDuration(days, hours, minutes);
    
    try {
      await ctx.editMessageText(
        "⏱️ *Настройка длительности голосования*\n\n" +
        `Текущее значение: ${formattedDuration}\n\n` +
        "Используйте кнопки для изменения значений:",
        { 
          reply_markup: keyboard,
          parse_mode: "Markdown"
        }
      );
    } catch (editError: any) {
      // Пропускаем ошибку о неизмененном сообщении
      if (editError.description && editError.description.includes('message is not modified')) {
        // Содержимое сообщения не изменилось, ничего делать не нужно
        logger.debug('Сообщение не изменилось, пропускаем обновление');
      } else {
        // Пробрасываем остальные ошибки
        throw editError;
      }
    }
  } catch (error) {
    logger.error("Ошибка при обновлении сообщения с настройками времени:", error);
  }
}

// Обработка настройки минимального количества голосов
adminController.callbackQuery("settings_min_votes", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const settings = await systemSettingsRepository.getSettings();
    
    // Сохраняем текущее значение в сессии
    if (ctx.session) {
      ctx.session.minVotesRequired = settings.minVotesRequired;
    }
    
    const keyboard = keyboardService.getMinVotesSettingsKeyboard(settings.minVotesRequired);
    
    await ctx.reply(
      "🔢 *Настройка минимального количества голосов*\n\n" +
      "Это минимальное количество голосов, необходимое для принятия решения по заявке.\n\n" +
      `Текущее значение: ${settings.minVotesRequired}`,
      { 
        reply_markup: keyboard,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "settingsMinVotes");
  }
});

// Обработка изменения минимального количества голосов
adminController.callbackQuery(/^min_votes_(plus|minus)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Инициализируем настройки, если их нет
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.minVotesRequired) {
      const settings = await systemSettingsRepository.getSettings();
      ctx.session.minVotesRequired = settings.minVotesRequired;
    }
    
    const action = ctx.match[1];
    
    if (action === 'plus' && ctx.session.minVotesRequired < 20) {
      ctx.session.minVotesRequired++;
    } else if (action === 'minus' && ctx.session.minVotesRequired > 1) {
      ctx.session.minVotesRequired--;
    }
    
    await updateMinVotesMessage(ctx);
  } catch (error) {
    await handleErrorWithContext(ctx, error, "minVotesUpdate");
  }
});

// Сохранение настроек минимального количества голосов
adminController.callbackQuery("min_votes_save", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.session?.minVotesRequired) {
      await ctx.reply("❌ Ошибка: настройки не найдены.");
      return;
    }
    
    // Сохраняем настройки
    await systemSettingsRepository.updateMinVotesRequired(ctx.session.minVotesRequired);
    
    await ctx.reply(
      "✅ Настройки минимального количества голосов сохранены:\n\n" +
      `Новое значение: ${ctx.session.minVotesRequired}`
    );
    
    // Возвращаемся в меню настроек
    const keyboard = new InlineKeyboard()
      .text("🔙 Назад к настройкам", "admin_settings");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "minVotesSaveSettings");
  }
});

// Возврат к настройкам из меню минимального количества голосов
adminController.callbackQuery(/^admin_settings$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Возвращаемся в меню настроек
    await ctx.editMessageText(
      "⚙️ Загрузка настроек...",
      { reply_markup: { inline_keyboard: [] } }
    );
    
    // Вызываем обработчик настроек
    await adminController.middleware()(
      { ...ctx, callbackQuery: { data: "admin_settings" } } as any,
      async () => {}
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "backToSettings");
  }
});

// Обработка настройки порога отрицательных оценок
adminController.callbackQuery("settings_neg_threshold", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const settings = await systemSettingsRepository.getSettings();
    
    // Сохраняем текущее значение в сессии
    if (ctx.session) {
      ctx.session.negativeThreshold = settings.negativeRatingsThreshold;
    }
    
    const keyboard = keyboardService.getNegativeThresholdSettingsKeyboard(settings.negativeRatingsThreshold);
    
    await ctx.reply(
      "👎 *Настройка порога отрицательных оценок*\n\n" +
      "Это количество отрицательных оценок, при достижении которого участник будет исключен из сервера.\n\n" +
      `Текущее значение: ${settings.negativeRatingsThreshold}`,
      { 
        reply_markup: keyboard,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    await handleErrorWithContext(ctx, error, "settingsNegThreshold");
  }
});

// Обработка изменения порога отрицательных оценок
adminController.callbackQuery(/^neg_threshold_(plus|minus)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Инициализируем настройки, если их нет
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.negativeThreshold) {
      const settings = await systemSettingsRepository.getSettings();
      ctx.session.negativeThreshold = settings.negativeRatingsThreshold;
    }
    
    const action = ctx.match[1];
    
    if (action === 'plus' && ctx.session.negativeThreshold < 50) {
      ctx.session.negativeThreshold++;
    } else if (action === 'minus' && ctx.session.negativeThreshold > 1) {
      ctx.session.negativeThreshold--;
    }
    
    await updateNegThresholdMessage(ctx);
  } catch (error) {
    await handleErrorWithContext(ctx, error, "negThresholdUpdate");
  }
});

// Сохранение настроек порога отрицательных оценок
adminController.callbackQuery("neg_threshold_save", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.session?.negativeThreshold) {
      await ctx.reply("❌ Ошибка: настройки не найдены.");
      return;
    }
    
    // Сохраняем настройки
    await systemSettingsRepository.updateNegativeRatingsThreshold(ctx.session.negativeThreshold);
    
    await ctx.reply(
      "✅ Настройки порога отрицательных оценок сохранены:\n\n" +
      `Новое значение: ${ctx.session.negativeThreshold}`
    );
    
    // Возвращаемся в меню настроек
    const keyboard = new InlineKeyboard()
      .text("🔙 Назад к настройкам", "admin_settings");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "negThresholdSaveSettings");
  }
});

// Вспомогательная функция для обновления сообщения с настройками минимального количества голосов
async function updateMinVotesMessage(ctx: MyContext) {
  try {
    if (!ctx.session?.minVotesRequired) return;
    
    const minVotes = ctx.session.minVotesRequired;
    
    const keyboard = keyboardService.getMinVotesSettingsKeyboard(minVotes);
    
    try {
      await ctx.editMessageText(
        "🔢 *Настройка минимального количества голосов*\n\n" +
        "Это минимальное количество голосов, необходимое для принятия решения по заявке.\n\n" +
        `Текущее значение: ${minVotes}`,
        { 
          reply_markup: keyboard,
          parse_mode: "Markdown"
        }
      );
    } catch (editError: any) {
      // Пропускаем ошибку о неизмененном сообщении
      if (editError.description && editError.description.includes('message is not modified')) {
        logger.debug('Сообщение не изменилось, пропускаем обновление');
      } else {
        throw editError;
      }
    }
  } catch (error) {
    logger.error("Ошибка при обновлении сообщения с настройками минимального количества голосов:", error);
  }
}

// Вспомогательная функция для обновления сообщения с настройками порога отрицательных оценок
async function updateNegThresholdMessage(ctx: MyContext) {
  try {
    if (!ctx.session?.negativeThreshold) return;
    
    const threshold = ctx.session.negativeThreshold;
    
    const keyboard = keyboardService.getNegativeThresholdSettingsKeyboard(threshold);
    
    try {
      await ctx.editMessageText(
        "👎 *Настройка порога отрицательных оценок*\n\n" +
        "Это количество отрицательных оценок, при достижении которого участник будет исключен из сервера.\n\n" +
        `Текущее значение: ${threshold}`,
        { 
          reply_markup: keyboard,
          parse_mode: "Markdown"
        }
      );
    } catch (editError: any) {
      // Пропускаем ошибку о неизмененном сообщении
      if (editError.description && editError.description.includes('message is not modified')) {
        logger.debug('Сообщение не изменилось, пропускаем обновление');
      } else {
        throw editError;
      }
    }
  } catch (error) {
    logger.error("Ошибка при обновлении сообщения с настройками порога отрицательных оценок:", error);
  }
}

// Обработка просмотра деталей заявки
adminController.callbackQuery(/^app_view_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные заявки
    const application = await applicationRepository.findById(applicationId);
    
    // Получаем данные пользователя
    const user = await userRepository.findById(application.userId);
    
    // Формируем детальное сообщение о заявке
    const statusText = application.status === ApplicationStatus.PENDING ? '⏳ Ожидает' : 
                     application.status === ApplicationStatus.VOTING ? '🗳️ Голосование' : 
                     application.status === ApplicationStatus.APPROVED ? '✅ Одобрена' : 
                     application.status === ApplicationStatus.REJECTED ? '❌ Отклонена' : 
                     application.status === ApplicationStatus.EXPIRED ? '⏰ Истекла' : 
                     '❓ Неизвестно';
    
    const createdDate = new Date(application.createdAt).toLocaleString('ru-RU');
    
    let message = `📝 *Заявка #${application.id}*\n\n` +
                 `👤 *Пользователь:* ${user.username ? `@${user.username}` : 'Не указан'}\n` +
                 `🆔 *Telegram ID:* ${user.telegramId}\n` +
                 `🎮 *Никнейм в Minecraft:* ${application.minecraftNickname}\n` +
                 `📊 *Статус:* ${statusText}\n` +
                 `📅 *Дата подачи:* ${createdDate}\n\n` +
                 `📌 *Причина вступления:*\n${application.reason}`;
    
    // Добавляем информацию о голосовании, если заявка находится на голосовании
    if (application.status === ApplicationStatus.VOTING) {
      const votesInfo = `\n\n🗳️ *Информация о голосовании:*\n` +
                       `👍 За: ${application.positiveVotes}\n` +
                       `👎 Против: ${application.negativeVotes}\n`;
      
      message += votesInfo;
      
      if (application.votingEndsAt) {
        const endsDate = new Date(application.votingEndsAt).toLocaleString('ru-RU');
        message += `⏱️ *Окончание голосования:* ${endsDate}`;
      }
    }
    
    // Создаем клавиатуру для действий с заявкой
    const keyboard = new InlineKeyboard();
    
    if (application.status === ApplicationStatus.PENDING) {
      keyboard
        .text("✅ Принять", `app_approve_${application.id}`)
        .text("❌ Отклонить", `app_reject_${application.id}`).row()
        .text("🗳️ Голосование", `app_start_voting_${application.id}`).row();
    } else if (application.status === ApplicationStatus.VOTING) {
      keyboard
        .text("✅ Принять", `app_approve_${application.id}`)
        .text("❌ Отклонить", `app_reject_${application.id}`).row();
    }
    
    keyboard.text("🔙 Назад к списку", "admin_applications").row();
    
    await ctx.reply(message, { 
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "viewApplicationDetails");
  }
});

// Обработка одобрения заявки
adminController.callbackQuery(/^app_approve_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные заявки
    const application = await applicationRepository.findById(applicationId);
    
    // Получаем данные пользователя
    const user = await userRepository.findById(application.userId);
    
    // Обновляем статус заявки на "Одобрена"
    await applicationRepository.updateStatus(applicationId, ApplicationStatus.APPROVED);
    
    // Обновляем роль пользователя на MEMBER и даем право голоса
    await userRepository.update(user.id, {
      role: UserRole.MEMBER,
      canVote: true
    });
    
    // Отправляем уведомление администратору
    await ctx.reply(
      `✅ Заявка #${applicationId} от ${application.minecraftNickname} успешно одобрена.`
    );
    
    // Отправляем уведомление пользователю
    if (getBotInstance()) {
      try {
        const bot = getBotInstance();
        if (bot) {
          await bot.api.sendMessage(
            Number(user.telegramId),
            `✅ Поздравляем! Ваша заявка на вступление в Minecraft-сервер одобрена.\n\n` +
            `Теперь вы можете подключиться к серверу, используя свой никнейм: ${application.minecraftNickname}\n\n` +
            `Приятной игры!`
          );
        }
      } catch (error) {
        logger.error(`Ошибка при отправке уведомления пользователю ${user.id}:`, error);
      }
    }
    
    // Возвращаемся к списку заявок
    const keyboard = new InlineKeyboard()
      .text("🔙 К списку заявок", "admin_applications");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "approveApplication");
  }
});

// Обработка отклонения заявки
adminController.callbackQuery(/^app_reject_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные заявки
    const application = await applicationRepository.findById(applicationId);
    
    // Получаем данные пользователя
    const user = await userRepository.findById(application.userId);
    
    // Обновляем статус заявки на "Отклонена"
    await applicationRepository.updateStatus(applicationId, ApplicationStatus.REJECTED);
    
    // Отправляем уведомление администратору
    await ctx.reply(
      `❌ Заявка #${applicationId} от ${application.minecraftNickname} отклонена.`
    );
    
    // Отправляем уведомление пользователю
    if (getBotInstance()) {
      try {
        const bot = getBotInstance();
        if (bot) {
          await bot.api.sendMessage(
            Number(user.telegramId),
            `❌ К сожалению, ваша заявка на вступление в Minecraft-сервер отклонена.\n\n` +
            `Вы можете подать новую заявку позже.`
          );
        }
      } catch (error) {
        logger.error(`Ошибка при отправке уведомления пользователю ${user.id}:`, error);
      }
    }
    
    // Возвращаемся к списку заявок
    const keyboard = new InlineKeyboard()
      .text("🔙 К списку заявок", "admin_applications");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "rejectApplication");
  }
});

// Обработка запуска голосования
adminController.callbackQuery(/^app_start_voting_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Извлекаем ID заявки из callback данных
    const applicationId = parseInt(ctx.match?.[1] || '0');
    
    // Получаем данные заявки
    const application = await applicationRepository.findById(applicationId);
    
    // Получаем настройки времени голосования
    const settings = await systemSettingsRepository.getSettings();
    
    // Рассчитываем дату окончания голосования
    const votingEndsAt = new Date();
    votingEndsAt.setDate(votingEndsAt.getDate() + settings.votingDurationDays);
    votingEndsAt.setHours(votingEndsAt.getHours() + settings.votingDurationHours);
    votingEndsAt.setMinutes(votingEndsAt.getMinutes() + settings.votingDurationMinutes);
    
    // Запускаем голосование
    await applicationRepository.startVoting(applicationId, votingEndsAt);
    
    // Получаем данные пользователя
    const user = await userRepository.findById(application.userId);
    
    // Отправляем уведомление администратору
    await ctx.reply(
      `🗳️ Голосование по заявке #${applicationId} от ${application.minecraftNickname} запущено.\n\n` +
      `Окончание голосования: ${votingEndsAt.toLocaleString('ru-RU')}`
    );
    
    // Отправляем уведомление пользователю
    if (getBotInstance()) {
      try {
        const bot = getBotInstance();
        if (bot) {
          await bot.api.sendMessage(
            Number(user.telegramId),
            `🗳️ По вашей заявке на вступление в Minecraft-сервер начато голосование.\n\n` +
            `Окончание голосования: ${votingEndsAt.toLocaleString('ru-RU')}\n\n` +
            `Результаты голосования будут отправлены вам автоматически.`
          );
        }
      } catch (error) {
        logger.error(`Ошибка при отправке уведомления пользователю ${user.id}:`, error);
      }
    }
    
    // Получаем список участников с правом голоса
    const voters = await userRepository.findVoters();
    
    // Отправляем уведомления участникам с правом голоса
    const bot = getBotInstance();
    if (bot && voters.length > 0) {
      const voteKeyboard = new InlineKeyboard()
        .text("👍 За", `vote_positive_${applicationId}`)
        .text("👎 Против", `vote_negative_${applicationId}`).row()
        .text("❓ Задать вопрос", `ask_question_${applicationId}`).row();
      
      for (const voter of voters) {
        // Не отправляем уведомление самому заявителю
        if (voter.id === user.id) continue;
        
        try {
          await bot.api.sendMessage(
            Number(voter.telegramId),
            `🗳️ *Новое голосование по заявке на вступление*\n\n` +
            `👤 Пользователь: ${user.username ? `@${user.username}` : 'Не указан'}\n` +
            `🎮 Никнейм: ${application.minecraftNickname}\n` +
            `📝 Причина: ${application.reason.substring(0, 100)}${application.reason.length > 100 ? '...' : ''}\n\n` +
            `⏱️ Окончание голосования: ${votingEndsAt.toLocaleString('ru-RU')}`,
            { 
              reply_markup: voteKeyboard,
              parse_mode: "Markdown"
            }
          );
        } catch (error) {
          logger.error(`Ошибка при отправке уведомления о голосовании участнику ${voter.id}:`, error);
        }
      }
    }
    
    // Возвращаемся к списку заявок
    const keyboard = new InlineKeyboard()
      .text("🔙 К списку заявок", "admin_applications");
    
    await ctx.reply("Выберите действие:", { reply_markup: keyboard });
  } catch (error) {
    await handleErrorWithContext(ctx, error, "startVoting");
  }
});

export { adminController }; 