import { Composer, InlineKeyboard } from 'grammy';
import type { MyContext } from '../index';
import { ratingService } from '../services/ratingService';
import { handleError, handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';
import { formatDate } from '../utils/stringUtils';

// Создаем репозиторий пользователей
const userRepository = new UserRepository();

// Создаем композер для работы с рейтингами
const ratingController = new Composer<MyContext>();

// Middleware для проверки прав голосования
const canVoteMiddleware = async (ctx: MyContext, next: () => Promise<void>) => {
  try {
    if (!ctx.from) {
      return await ctx.reply("⚠️ Не удалось определить пользователя.");
    }
    
    const user = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!user) {
      return await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
    }
    
    if (!user.canVote) {
      return await ctx.reply("⚠️ У вас нет прав для голосования или оценки участников.");
    }
    
    await next();
  } catch (error) {
    await handleErrorWithContext(ctx, error, "canVoteMiddleware");
  }
};

// Показать список участников для оценки
ratingController.command("members", async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }

    const user = await userRepository.findByTelegramId(userId);
    if (!user || !user.canVote) {
      await ctx.reply('❌ У вас нет прав для просмотра списка участников и выставления оценок');
      return;
    }

    const members = await userRepository.findAllMembers();
    if (members.length === 0) {
      await ctx.reply('ℹ️ В сообществе пока нет участников');
      return;
    }

    // Создаем клавиатуру для выбора пользователя для оценки
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
    logger.error('Ошибка в команде members:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка участников');
  }
});

// Обработчик выбора участника из списка
ratingController.callbackQuery(/^select_member_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя по ID
    const targetUser = await userRepository.findById(targetUserId);
    
    if (!targetUser) {
      await ctx.reply("⚠️ Пользователь не найден.");
      return;
    }
    
    // Получаем детальную информацию о рейтинге
    const ratingsDetails = await ratingService.getUserRatingsDetails(targetUserId);
    
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
      .text("« Назад к списку", "back_to_members");
    
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Ошибка при выборе участника:', error);
    await ctx.reply('❌ Произошла ошибка при выборе участника');
  }
});

// Команда для положительной оценки
ratingController.command('rate_up', canVoteMiddleware, handleError(async (ctx) => {
  if (!ctx.from) {
    await ctx.reply('❌ Не удалось определить пользователя');
    return;
  }

  if (!ctx.message?.text) {
    await ctx.reply('❌ Некорректный формат команды');
    return;
  }

  const args = ctx.message.text?.split(' ');
  if (!args || args.length < 2) {
    await ctx.reply('❌ Укажите ID пользователя: /rate_up <ID> [причина]');
    return;
  }

  const targetId = parseInt(args[1] ?? '0');
  if (isNaN(targetId)) {
    await ctx.reply('❌ Некорректный ID пользователя');
    return;
  }

  const reason = args.length > 2 ? args.slice(2).join(' ') : undefined;
  const rater = await userRepository.findByTelegramId(ctx.from.id);
  if (!rater) {
    await ctx.reply('❌ Не удалось найти ваш профиль');
    return;
  }

  const success = await ratingService.addRating(rater.id, targetId, true, reason);
  if (success) {
    const target = await userRepository.findById(targetId);
    if (!target) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }
    const displayName = target.nickname || target.minecraftNickname;
    let message = `✅ Вы поставили положительную оценку пользователю ${displayName}`;
    if (reason) {
      message += `\nПричина: ${reason}`;
    }
    await ctx.reply(message);
  } else {
    await ctx.reply('❌ Не удалось выставить оценку. Возможно, вы уже оценивали этого пользователя недавно.');
  }
}));

// Команда для отрицательной оценки
ratingController.command('rate_down', canVoteMiddleware, handleError(async (ctx) => {
  if (!ctx.from) {
    await ctx.reply('❌ Не удалось определить пользователя');
    return;
  }

  if (!ctx.message?.text) {
    await ctx.reply('❌ Некорректный формат команды');
    return;
  }

  const args = ctx.message.text?.split(' ');
  if (!args || args.length < 2) {
    await ctx.reply('❌ Укажите ID пользователя: /rate_down <ID> [причина]');
    return;
  }

  const targetId = parseInt(args[1] ?? '0');
  if (isNaN(targetId)) {
    await ctx.reply('❌ Некорректный ID пользователя');
    return;
  }

  const reason = args.length > 2 ? args.slice(2).join(' ') : undefined;
  const rater = await userRepository.findByTelegramId(ctx.from.id);
  if (!rater) {
    await ctx.reply('❌ Не удалось найти ваш профиль');
    return;
  }

  const success = await ratingService.addRating(rater.id, targetId, false, reason);
  if (success) {
    const target = await userRepository.findById(targetId);
    if (!target) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }
    const displayName = target.nickname || target.minecraftNickname;
    let message = `✅ Вы поставили отрицательную оценку пользователю ${displayName}`;
    if (reason) {
      message += `\nПричина: ${reason}`;
    }
    await ctx.reply(message);
  } else {
    await ctx.reply('❌ Не удалось выставить оценку. Возможно, вы уже оценивали этого пользователя недавно.');
  }
}));

// Команда для просмотра истории оценок
ratingController.command('ratings', canVoteMiddleware, handleError(async (ctx) => {
  if (!ctx.from) {
    await ctx.reply('❌ Не удалось определить пользователя');
    return;
  }

  if (!ctx.message?.text) {
    await ctx.reply('❌ Некорректный формат команды');
    return;
  }

  const args = ctx.message.text?.split(' ');
  if (!args) {
    await ctx.reply('❌ Некорректный формат команды');
    return;
  }

  const targetId = args.length > 1 ? parseInt(args[1] ?? '0') : null;

  const user = await userRepository.findByTelegramId(ctx.from.id);
  if (!user) {
    await ctx.reply('❌ Не удалось найти ваш профиль');
    return;
  }

  let target;
  if (targetId) {
    target = await userRepository.findById(targetId);
    if (!target) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }
  } else {
    target = user;
  }

  const displayName = target.nickname || target.minecraftNickname;
  const ratings = await ratingService.getRatingDetails(target.id);
  if (ratings.length === 0) {
    await ctx.reply(`ℹ️ У пользователя ${displayName} пока нет оценок`);
    return;
  }

  let message = `📊 *История оценок ${displayName}:*\n\n`;
  for (const rating of ratings) {
    const icon = rating.isPositive ? '👍' : '👎';
    const date = formatDate(rating.createdAt);
    message += `${icon} от ${rating.raterNickname} (${date})`;
    if (rating.reason) {
      message += `\n└ Причина: ${rating.reason}`;
    }
    message += '\n\n';
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}));

// Команда для просмотра профиля другого пользователя
ratingController.command("viewprofile", async (ctx) => {
  try {
    // Получаем список всех участников
    const members = await ratingService.getAllMembersWithRatings();
    
    if (members.length === 0) {
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
    await handleErrorWithContext(ctx, error, "viewProfileCommand");
  }
});

// Обработчик инлайн-кнопок для просмотра профиля
ratingController.callbackQuery(/^view_profile_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя по ID
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
    await handleErrorWithContext(ctx, error, "viewProfileCallback");
  }
});

// Обработчик кнопки "Назад к списку участников"
ratingController.callbackQuery("back_to_members", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }

    const user = await userRepository.findByTelegramId(userId);
    if (!user || !user.canVote) {
      await ctx.reply('❌ У вас нет прав для просмотра списка участников и выставления оценок');
      return;
    }

    const members = await userRepository.findAllMembers();
    if (members.length === 0) {
      await ctx.reply('ℹ️ В сообществе пока нет участников');
      return;
    }

    // Создаем клавиатуру для выбора пользователя для оценки
    const keyboard = new InlineKeyboard();
    
    // Добавляем по 2 пользователя в ряд
    for (let i = 0; i < members.length; i += 2) {
      const firstMember = members[i];
      const secondMember = i + 1 < members.length ? members[i + 1] : null;
      
      if (firstMember) {
        const displayName = firstMember.username ? `@${firstMember.username}` : firstMember.minecraftNickname;
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
    
    await ctx.editMessageText("📊 *Список участников для оценки*\n\nВыберите пользователя, чтобы поставить ему оценку:", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('Ошибка при возврате к списку участников:', error);
    await ctx.reply('❌ Произошла ошибка при возврате к списку участников');
  }
});

// Обработчик кнопки "Положительная оценка"
ratingController.callbackQuery(/^rate_positive_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Проверяем права голосования
    const rater = await userRepository.findByTelegramId(ctx.from.id);
    if (!rater || !rater.canVote) {
      await ctx.reply('❌ У вас нет прав для оценки участников');
      return;
    }
    
    // Запрашиваем ввод причины оценки
    ctx.session.targetUserId = targetUserId;
    
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    // Создаем клавиатуру для отмены
    const keyboard = new InlineKeyboard()
      .text("❌ Отмена", `cancel_rating_${targetUserId}`);
    
    await ctx.reply(`Вы собираетесь поставить 👍 положительную оценку пользователю ${targetUser.username || targetUser.minecraftNickname}.\n\nПожалуйста, введите причину оценки или нажмите кнопку "Отмена":`, {
      reply_markup: keyboard
    });
    
    // Устанавливаем шаг в сессии для ожидания ввода причины положительной оценки
    if (ctx.session) {
      ctx.session.step = 'waiting_positive_rating_reason';
    }
    
  } catch (error) {
    logger.error('Ошибка при выставлении положительной оценки:', error);
    await ctx.reply('❌ Произошла ошибка при выставлении оценки');
  }
});

// Обработчик кнопки "Отрицательная оценка"
ratingController.callbackQuery(/^rate_negative_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Проверяем права голосования
    const rater = await userRepository.findByTelegramId(ctx.from.id);
    if (!rater || !rater.canVote) {
      await ctx.reply('❌ У вас нет прав для оценки участников');
      return;
    }
    
    // Запрашиваем ввод причины оценки
    ctx.session.targetUserId = targetUserId;
    
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    // Создаем клавиатуру для отмены
    const keyboard = new InlineKeyboard()
      .text("❌ Отмена", `cancel_rating_${targetUserId}`);
    
    await ctx.reply(`⚠️ Вы собираетесь поставить 👎 отрицательную оценку пользователю ${targetUser.username || targetUser.minecraftNickname}.\n\nПожалуйста, введите причину оценки (обязательно) или нажмите кнопку "Отмена":`, {
      reply_markup: keyboard
    });
    
    // Устанавливаем шаг в сессии для ожидания ввода причины отрицательной оценки
    if (ctx.session) {
      ctx.session.step = 'waiting_negative_rating_reason';
    }
    
  } catch (error) {
    logger.error('Ошибка при выставлении отрицательной оценки:', error);
    await ctx.reply('❌ Произошла ошибка при выставлении оценки');
  }
});

// Обработчик кнопки "История оценок"
ratingController.callbackQuery(/^show_ratings_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя по ID
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }
    
    // Получаем историю оценок
    const ratings = await ratingService.getRatingDetails(targetUserId);
    
    if (ratings.length === 0) {
      // Создаем клавиатуру для возврата
      const keyboard = new InlineKeyboard()
        .text("« Назад", `select_member_${targetUserId}`);
      
      await ctx.reply(`ℹ️ У пользователя ${targetUser.username || targetUser.minecraftNickname} пока нет оценок`, {
        reply_markup: keyboard
      });
      return;
    }
    
    // Формируем сообщение с историей оценок
    let message = `📊 *История оценок пользователя ${targetUser.username ? `@${targetUser.username.replace(/_/g, '\\_')}` : targetUser.minecraftNickname}:*\n\n`;
    
    for (const rating of ratings.slice(0, 10)) { // Ограничиваем 10 последними оценками
      const icon = rating.isPositive ? '👍' : '👎';
      const date = formatDate(rating.createdAt);
      message += `${icon} от ${rating.raterNickname} (${date})`;
      if (rating.reason) {
        message += `\n└ Причина: ${rating.reason}`;
      }
      message += '\n\n';
    }
    
    if (ratings.length > 10) {
      message += `... и ещё ${ratings.length - 10} оценок`;
    }
    
    // Создаем клавиатуру для возврата
    const keyboard = new InlineKeyboard()
      .text("« Назад", `select_member_${targetUserId}`);
    
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Ошибка при просмотре истории оценок:', error);
    await ctx.reply('❌ Произошла ошибка при просмотре истории оценок');
  }
});

// Обработчик кнопки "Отмена рейтинга"
ratingController.callbackQuery(/^cancel_rating_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    // Сбрасываем шаг в сессии
    if (ctx.session) {
      delete ctx.session.step;
      delete ctx.session.targetUserId;
    }
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    await ctx.reply('❌ Выставление оценки отменено');
    
    // Возвращаемся к информации о пользователе
    if (targetUserId) {
      // Создаем запрос на получение информации о пользователе заново
      const keyboard = new InlineKeyboard()
        .text("« Вернуться к профилю", `select_member_${targetUserId}`);
      
      await ctx.reply("Вы можете вернуться к просмотру профиля пользователя", {
        reply_markup: keyboard
      });
    }
    
  } catch (error) {
    logger.error('Ошибка при отмене выставления оценки:', error);
    await ctx.reply('❌ Произошла ошибка при отмене выставления оценки');
  }
});

// Обработчик текстовых сообщений для завершения процесса оценки
ratingController.on('message:text', async (ctx, next) => {
  try {
    // Проверяем, находится ли пользователь в процессе оценки
    if (ctx.session?.step === 'waiting_positive_rating_reason' || 
        ctx.session?.step === 'waiting_negative_rating_reason') {
      
      const isPositive = ctx.session.step === 'waiting_positive_rating_reason';
      const targetUserId = ctx.session.targetUserId;
      const reason = ctx.message.text;
      
      if (!targetUserId) {
        await ctx.reply('❌ Произошла ошибка: не указан пользователь для оценки');
        delete ctx.session.step;
        delete ctx.session.targetUserId;
        return;
      }
      
      // Если это отрицательная оценка, проверяем наличие причины
      if (!isPositive && (!reason || reason.trim().length < 3)) {
        await ctx.reply('⚠️ Для отрицательной оценки необходимо указать причину (минимум 3 символа)');
        return;
      }
      
      // Получаем данные о пользователях
      if (!ctx.from) {
        await ctx.reply('❌ Не удалось определить вас как пользователя');
        return;
      }
      
      const rater = await userRepository.findByTelegramId(ctx.from.id);
      if (!rater) {
        await ctx.reply('❌ Не удалось найти ваш профиль');
        delete ctx.session.step;
        delete ctx.session.targetUserId;
        return;
      }
      
      const target = await userRepository.findById(targetUserId);
      if (!target) {
        await ctx.reply('❌ Пользователь для оценки не найден');
        delete ctx.session.step;
        delete ctx.session.targetUserId;
        return;
      }
      
      // Выставляем оценку
      const success = await ratingService.addRating(rater.id, targetUserId, isPositive, reason);
      
      // Очищаем состояние сессии
      delete ctx.session.step;
      delete ctx.session.targetUserId;
      
      if (success) {
        const displayName = target.username ? `@${target.username}` : target.minecraftNickname;
        const ratingType = isPositive ? '👍 положительную' : '👎 отрицательную';
        
        // Создаем клавиатуру для возврата к профилю
        const keyboard = new InlineKeyboard()
          .text("« Вернуться к профилю", `select_member_${targetUserId}`);
        
        let message = `✅ Вы поставили ${ratingType} оценку пользователю ${displayName}`;
        if (reason) {
          message += `\nПричина: ${reason}`;
        }
        
        await ctx.reply(message, {
          reply_markup: keyboard
        });
      } else {
        await ctx.reply('❌ Не удалось выставить оценку. Возможно, вы уже оценивали этого пользователя недавно.');
      }
      
      return;
    }
    
    // Если это не сообщение для оценки, передаем управление следующему обработчику
    await next();
  } catch (error) {
    logger.error('Ошибка при обработке причины оценки:', error);
    await ctx.reply('❌ Произошла ошибка при обработке оценки');
    
    // Очищаем состояние сессии в случае ошибки
    if (ctx.session) {
      delete ctx.session.step;
      delete ctx.session.targetUserId;
    }
  }
});

export { ratingController }; 