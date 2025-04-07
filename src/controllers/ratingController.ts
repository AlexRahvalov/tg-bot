import { Composer, InlineKeyboard } from 'grammy';
import type { MyContext } from '../index';
import { ratingService } from '../services/ratingService';
import { handleErrorWithContext } from '../utils/errorHandler';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';

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
    // Получаем список всех участников
    const members = await ratingService.getAllMembersWithRatings();
    
    if (members.length === 0) {
      await ctx.reply("👥 Активных участников не найдено.");
      return;
    }
    
    let message = "👥 *Список участников сервера:*\n\n";
    
    for (const member of members) {
      const memberInfo = `👤 *${member.minecraftNickname}*${member.username ? ` (@${member.username})` : ''}\n` +
                        `Репутация: ${member.reputation > 0 ? '👍 ' : ''}${member.reputation < 0 ? '👎 ' : ''}${member.reputation}\n\n`;
      
      message += memberInfo;
      
      // Создаем клавиатуру для оценки участника
      const keyboard = new InlineKeyboard()
        .text("👍 Респект", `rate_positive_${member.id}`)
        .text("👎 Жалоба", `rate_negative_${member.id}`).row();
      
      await ctx.reply(`Участник: ${member.minecraftNickname}`, { reply_markup: keyboard });
    }
  } catch (error) {
    await handleErrorWithContext(ctx, error, "membersList");
  }
});

// Обработчик положительных оценок
ratingController.callbackQuery(/^rate_positive_(\d+)$/, canVoteMiddleware, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя, который оценивает
    const rater = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!rater) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
      return;
    }
    
    // Проверяем, что пользователь не оценивает сам себя
    if (rater.id === targetUserId) {
      await ctx.reply("⚠️ Вы не можете оценить сами себя.");
      return;
    }
    
    // Добавляем положительную оценку
    const result = await ratingService.addRating(rater.id, targetUserId, true);
    
    if (result) {
      // Получаем обновленные данные пользователя после оценки
      const targetUser = await userRepository.findById(targetUserId);
      
      await ctx.reply(
        `✅ Вы поставили 👍 участнику ${targetUser.minecraftNickname}.\n` +
        `Текущая репутация: ${targetUser.reputation}`
      );
    } else {
      await ctx.reply("❌ Не удалось добавить оценку. Пожалуйста, попробуйте позже.");
    }
  } catch (error) {
    await handleErrorWithContext(ctx, error, "positiveRating");
  }
});

// Обработчик отрицательных оценок
ratingController.callbackQuery(/^rate_negative_(\d+)$/, canVoteMiddleware, async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    const targetUserId = parseInt(ctx.match[1] || '0');
    
    // Получаем пользователя, который оценивает
    const rater = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!rater) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
      return;
    }
    
    // Проверяем, что пользователь не оценивает сам себя
    if (rater.id === targetUserId) {
      await ctx.reply("⚠️ Вы не можете оценить сами себя.");
      return;
    }
    
    // Запрашиваем причину отрицательной оценки
    await ctx.reply(
      "❓ Пожалуйста, укажите причину жалобы на этого участника:"
    );
    
    // Сохраняем информацию о жалобе в сессии
    if (ctx.session) {
      ctx.session.step = 'waiting_rating_reason';
      ctx.session.targetUserId = targetUserId;
    }
  } catch (error) {
    await handleErrorWithContext(ctx, error, "negativeRating");
  }
});

// Обработчик для получения причины жалобы
ratingController.on('message:text', async (ctx) => {
  try {
    // Проверяем, что мы ожидаем причину жалобы
    if (!ctx.session?.step || ctx.session.step !== 'waiting_rating_reason' || !ctx.session.targetUserId) {
      return; // Пропускаем, если это не ожидание причины жалобы
    }
    
    if (!ctx.from || !ctx.message) return;
    
    const targetUserId = ctx.session.targetUserId;
    const reason = ctx.message.text;
    
    // Получаем пользователя, который оценивает
    const rater = await userRepository.findByTelegramId(ctx.from.id);
    
    if (!rater) {
      await ctx.reply("⚠️ Вы не зарегистрированы в системе.");
      ctx.session.step = undefined;
      ctx.session.targetUserId = undefined;
      return;
    }
    
    // Добавляем отрицательную оценку
    const result = await ratingService.addRating(rater.id, targetUserId, false);
    
    if (result) {
      // Получаем обновленные данные пользователя после оценки
      const targetUser = await userRepository.findById(targetUserId);
      
      // Логируем причину жалобы
      logger.info(`Жалоба от ${rater.minecraftNickname} на ${targetUser.minecraftNickname}: ${reason}`, {
        raterUserId: rater.id,
        targetUserId,
        reason
      });
      
      await ctx.reply(
        `✅ Вы поставили 👎 участнику ${targetUser.minecraftNickname}.\n` +
        `Причина: ${reason}\n` +
        `Текущая репутация: ${targetUser.reputation}`
      );
      
      // Если репутация слишком низкая - уведомляем о возможном исключении
      if (targetUser.reputation <= -3) {
        await ctx.reply(
          "⚠️ Обратите внимание, что при накоплении отрицательных оценок " +
          "участник может быть автоматически исключен из сообщества."
        );
      }
    } else {
      await ctx.reply("❌ Не удалось добавить оценку. Пожалуйста, попробуйте позже.");
    }
    
    // Сбрасываем состояние сессии
    ctx.session.step = undefined;
    ctx.session.targetUserId = undefined;
  } catch (error) {
    await handleErrorWithContext(ctx, error, "ratingReason");
    
    // Сбрасываем состояние сессии в случае ошибки
    if (ctx.session) {
      ctx.session.step = undefined;
      ctx.session.targetUserId = undefined;
    }
  }
});

export { ratingController }; 