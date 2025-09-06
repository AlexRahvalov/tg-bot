import { Composer } from 'grammy';
import { ProfileService } from '../services/profileService';
import type { MyContext } from '../index';
import { logger } from '../utils/logger';
import { formatDate } from '../utils/stringUtils';
import { UserRepository } from '../db/repositories/userRepository';
import { handleError } from '../utils/errorHandler';

const profileService = new ProfileService();
const userRepository = new UserRepository();
const profileController = new Composer<MyContext>();

logger.info('🔄 Инициализация контроллера профиля');

// Команда для просмотра своего профиля
profileController.command('profile', async (ctx) => {
  logger.info('📝 Получена команда /profile через контроллер профиля');
  
  try {
    if (!ctx.from) {
      logger.error('Пользователь не определен в контексте');
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }
    
    const telegramId = ctx.from.id;
    logger.info(`Запрос профиля для пользователя с Telegram ID: ${telegramId}`);

    // Проверяем, зарегистрирован ли пользователь
    const user = await userRepository.findByTelegramId(telegramId);
    
    // Безопасное логирование объекта пользователя
    if (user) {
      logger.info('Пользователь найден в базе данных');
      logger.info(`Имя пользователя: ${user.username}, роль: ${user.role}`);
    } else {
      logger.info('Пользователь не найден в базе данных');
    }
    
    if (!user) {
      await ctx.reply('❌ Вы не зарегистрированы в системе. Пожалуйста, подайте заявку на вступление командой /apply');
      return;
    }
    
    // Получаем профиль пользователя
    const profile = await profileService.getProfile(telegramId);
    
    // Безопасное логирование
    if (profile) {
      logger.info('Профиль пользователя найден');
      logger.info(`Никнейм: ${profile.nickname}, Minecraft: ${profile.minecraft_username || 'не указан'}`);
    } else {
      logger.info('Профиль пользователя не найден');
    }
    
    if (!profile) {
      await ctx.reply('❌ Профиль не найден. Возможно, вы еще не являетесь участником сообщества.');
      return;
    }

    // Получаем историю оценок
    const ratingHistory = await profileService.getRatingHistory(profile.user_id);
    
    const reputationScore = profile.positive_ratings_received - profile.negative_ratings_received;

    // Формируем сообщение с информацией о профиле
    let message = `📊 *Ваш профиль:*\n\n`;
    message += `👤 Никнейм: ${profile.nickname}\n`;
    if (profile.minecraft_username) {
      message += `🎮 Minecraft: ${profile.minecraft_username}\n`;
    }
    message += `📅 Дата вступления: ${formatDate(profile.join_date)}\n\n`;
    
    message += `*Статистика рейтинга:*\n`;
    message += `⭐️ Репутация: ${reputationScore}\n`;
    message += `👍 Положительные оценки: ${profile.positive_ratings_received}\n`;
    message += `👎 Отрицательные оценки: ${profile.negative_ratings_received}\n`;
    message += `📊 Всего получено оценок: ${profile.total_ratings_received}\n`;
    message += `✍️ Выдано оценок: ${profile.total_ratings_given}\n\n`;

    // Добавляем последние оценки, если они есть
    if (ratingHistory && ratingHistory.length > 0) {
      message += `*Последние оценки:*\n`;
      ratingHistory.slice(0, 5).forEach(rating => {
        const icon = rating.isPositive ? '👍' : '👎';
        message += `${icon} от ${rating.raterNickname}`;
        if (rating.reason) {
          message += `: ${rating.reason}`;
        }
        message += '\n';
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
    logger.info('Сообщение с профилем успешно отправлено');
  } catch (error) {
    logger.error('Ошибка в обработке команды /profile:', error);
    console.error('Подробная ошибка:', error);
    await ctx.reply('❌ Произошла ошибка при получении профиля');
  }
});

// Команда для просмотра профиля другого пользователя
profileController.command('viewprofile', handleError(async (ctx) => {
    const text = ctx.message?.text;
    if (!text) {
        await ctx.reply('❌ Не удалось получить текст сообщения');
        return;
    }

    const args = text.split(' ');
    if (args.length < 2) {
        await ctx.reply('❌ Пожалуйста, укажите никнейм пользователя: /viewprofile <никнейм>');
        return;
    }

    const targetNickname = args[1] || '';
    if (!targetNickname) {
        await ctx.reply('❌ Никнейм не может быть пустым');
        return;
    }

    const profiles = await profileService.getProfileByNickname(targetNickname);
    
    if (!profiles || profiles.length === 0) {
        await ctx.reply('❌ Пользователь с таким никнеймом не найден');
        return;
    }

    const profile = profiles[0];
    if (!profile) {
        await ctx.reply('❌ Профиль не найден');
        return;
    }

    const ratingHistory = await profileService.getRatingHistory(profile.user_id);
    const reputationScore = profile.positive_ratings_received - profile.negative_ratings_received;

    let message = `📊 *Профиль ${profile.nickname}:*\n\n`;
    if (profile.minecraft_username) {
        message += `🎮 Minecraft: ${profile.minecraft_username}\n`;
    }
    message += `📅 Дата вступления: ${formatDate(profile.join_date)}\n\n`;
    
    message += `*Статистика рейтинга:*\n`;
    message += `⭐️ Репутация: ${reputationScore}\n`;
    message += `👍 Положительные оценки: ${profile.positive_ratings_received}\n`;
    message += `👎 Отрицательные оценки: ${profile.negative_ratings_received}\n`;
    message += `📊 Всего получено оценок: ${profile.total_ratings_received}\n\n`;

    if (ratingHistory.length > 0) {
        message += `*Последние оценки:*\n`;
        ratingHistory.slice(0, 5).forEach(rating => {
            const icon = rating.isPositive ? '👍' : '👎';
            message += `${icon} от ${rating.raterNickname}`;
            if (rating.reason) {
                message += `: ${rating.reason}`;
            }
            message += '\n';
        });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
}));

export { profileController };