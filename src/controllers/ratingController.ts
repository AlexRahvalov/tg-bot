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

    let message = '📊 *Список участников:*\n\n';
    for (const member of members) {
      const reputationIcon = member.reputation > 0 ? '⭐️' : member.reputation < 0 ? '⚠️' : '➖';
      message += `${reputationIcon} ${member.nickname}\n`;
      message += `├ Репутация: ${member.reputation}\n`;
      message += `└ ID: \`${member.id}\`\n\n`;
    }

    message += '\n*Как оценить участника:*\n';
    message += '1. Скопируйте ID участника\n';
    message += '2. Отправьте команду:\n';
    message += '👍 Положительная оценка:\n';
    message += '`/rate_up <ID> [причина]`\n\n';
    message += '👎 Отрицательная оценка:\n';
    message += '`/rate_down <ID> [причина]`\n';

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in members command:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка участников');
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

export { ratingController }; 