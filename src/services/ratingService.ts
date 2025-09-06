import { executeQuery } from '../db/connection';
import { logger } from '../utils/logger';
import { UserRepository } from '../db/repositories/userRepository';
import type { User, Rating, RatingDetail } from '../models/types';
import { UserRole } from '../models/types';
import { MinecraftService } from './minecraftService';
import { SystemSettingsRepository } from '../db/repositories/systemSettingsRepository';
import { Bot } from 'grammy';
import type { MyContext } from '../index';

/**
 * Сервис для работы с оценками участников сообщества
 */
export class RatingService {
  private userRepository: UserRepository;
  private minecraftService: MinecraftService;
  private systemSettingsRepository: SystemSettingsRepository;
  private bot: Bot<MyContext> | null = null;
  
  constructor() {
    this.userRepository = new UserRepository();
    this.minecraftService = new MinecraftService();
    this.systemSettingsRepository = new SystemSettingsRepository();
  }
  
  // Метод для установки экземпляра бота
  setBotInstance(bot: Bot<MyContext>) {
    this.bot = bot;
  }
  
  /**
   * Добавление оценки участнику
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   * @param isPositive Положительная ли оценка
   * @param reason Причина оценки (опционально)
   */
  async addRating(raterUserId: number, targetUserId: number, isPositive: boolean, reason?: string): Promise<boolean> {
    try {
      // Проверка, что пользователь не оценивает сам себя
      if (raterUserId === targetUserId) {
        logger.warn('Попытка оценить самого себя', { raterUserId, targetUserId });
        return false;
      }
      
      // Проверка, что оценивающий имеет право голосовать
      const rater = await this.userRepository.findById(raterUserId);
      if (!rater.canVote) {
        logger.warn('Пользователь без права голосования пытается оценить другого', { raterUserId });
        return false;
      }

      // Проверка кулдауна
      const settings = await this.systemSettingsRepository.getSettings();
      const lastRating = await this.getLastRatingBetweenUsers(raterUserId, targetUserId);
      if (lastRating) {
        const cooldownMinutes = settings.ratingCooldownMinutes || 60;
        const cooldownEnd = new Date(lastRating.createdAt);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);
        
        if (cooldownEnd > new Date()) {
          logger.warn('Попытка оценить пользователя во время кулдауна', { raterUserId, targetUserId });
          return false;
        }
      }

      // Проверка дневного лимита оценок
      const todayRatings = await this.getTodayRatingsCount(raterUserId);
      const maxDailyRatings = settings.maxDailyRatings || 10;
      if (todayRatings >= maxDailyRatings) {
        logger.warn('Превышен дневной лимит оценок', { raterUserId, todayRatings });
        return false;
      }
      
      // Проверка, что оцениваемый пользователь является участником или админом
      const target = await this.userRepository.findById(targetUserId);
      if (target.role !== UserRole.MEMBER && target.role !== UserRole.ADMIN) {
        logger.warn('Попытка оценить пользователя с недопустимой ролью', { targetUserId, role: target.role });
        return false;
      }
      
      // Проверка на существование предыдущей оценки
      const existingRating = await this.getRating(raterUserId, targetUserId);
      
      if (existingRating) {
        // Если оценка совпадает - удаляем её (снимаем)
        if (existingRating.isPositive === isPositive) {
          await this.removeRating(existingRating.id);
          await this.updateUserReputation(targetUserId);
          logger.info('Оценка снята', { raterUserId, targetUserId, isPositive });
          return true;
        }
        
        // Если оценка не совпадает - обновляем её
        await this.updateRating(existingRating.id, isPositive, reason);
        await this.updateUserReputation(targetUserId);
        logger.info('Оценка обновлена', { raterUserId, targetUserId, isPositive });
        return true;
      }
      
      // Создаем новую оценку
      await this.createRating(raterUserId, targetUserId, isPositive, reason);
      await this.updateUserReputation(targetUserId);

      // Обновляем статистику оценивающего
      await this.userRepository.update(raterUserId, {
        totalRatingsGiven: (rater.totalRatingsGiven || 0) + 1,
        lastRatingGiven: new Date()
      });

      logger.info('Оценка добавлена', { raterUserId, targetUserId, isPositive });
      
      // Проверяем, не превышен ли порог отрицательных оценок
      await this.checkNegativeRatingsThreshold(targetUserId);
      
      return true;
      
    } catch (error) {
      logger.error('Ошибка при добавлении оценки', error);
      return false;
    }
  }
  
  /**
   * Получение оценки пользователя
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   */
  private async getRating(raterUserId: number, targetUserId: number): Promise<Rating | null> {
    try {
      const ratings = await executeQuery(
        `SELECT * FROM ratings WHERE rater_id = ? AND target_user_id = ?`,
        [raterUserId, targetUserId]
      );
      
      if (ratings.length === 0) {
        return null;
      }
      
      return this.mapDbToRating(ratings[0]);
    } catch (error) {
      logger.error('Ошибка при получении оценки', error);
      return null;
    }
  }
  
  /**
   * Получение количества оценок, выданных пользователем за сегодня
   * @param userId ID пользователя
   */
  private async getTodayRatingsCount(userId: number): Promise<number> {
    const result = await executeQuery(
      `SELECT COUNT(*) as count 
       FROM ratings 
       WHERE rater_id = ? 
       AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    return result[0].count;
  }
  
  /**
   * Получение последней оценки между пользователями
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   */
  private async getLastRatingBetweenUsers(raterUserId: number, targetUserId: number): Promise<Rating | null> {
    const ratings = await executeQuery(
      `SELECT * FROM ratings 
       WHERE rater_id = ? AND target_user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [raterUserId, targetUserId]
    );

    if (ratings.length === 0) {
      return null;
    }

    return this.mapDbToRating(ratings[0]);
  }
  
  /**
   * Создание новой оценки
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   * @param isPositive Положительная ли оценка
   * @param reason Причина оценки (опционально)
   */
  private async createRating(raterUserId: number, targetUserId: number, isPositive: boolean, reason?: string): Promise<number> {
    const result = await executeQuery(
      `INSERT INTO ratings (rater_id, target_user_id, value, is_positive, reason) VALUES (?, ?, ?, ?, ?)`,
      [raterUserId, targetUserId, isPositive ? 1 : -1, isPositive, reason || null]
    );
    
    return result.insertId;
  }
  
  /**
   * Обновление существующей оценки
   * @param ratingId ID оценки
   * @param isPositive Новое значение оценки
   * @param reason Новая причина оценки (опционально)
   */
  private async updateRating(ratingId: number, isPositive: boolean, reason?: string): Promise<void> {
    await executeQuery(
      `UPDATE ratings SET value = ?, is_positive = ?, reason = ? WHERE id = ?`,
      [isPositive ? 1 : -1, isPositive, reason || null, ratingId]
    );
  }
  
  /**
   * Удаление оценки
   * @param ratingId ID оценки
   */
  private async removeRating(ratingId: number): Promise<void> {
    await executeQuery(
      `DELETE FROM ratings WHERE id = ?`,
      [ratingId]
    );
  }
  
  /**
   * Обновление репутации пользователя
   * @param userId ID пользователя
   */
  private async updateUserReputation(userId: number): Promise<void> {
    // Получаем все оценки пользователя
    const ratings = await executeQuery(
      `SELECT is_positive FROM ratings WHERE target_user_id = ?`,
      [userId]
    );
    
    // Считаем репутацию (положительные +1, отрицательные -1)
    let reputation = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const rating of ratings) {
      if (rating.is_positive) {
        reputation += 1;
        positiveCount += 1;
      } else {
        reputation -= 1;
        negativeCount += 1;
      }
    }
    
    // Обновляем репутацию пользователя в БД
    await executeQuery(
      `UPDATE users 
       SET reputation = ?,
           positive_ratings_received = ?,
           negative_ratings_received = ?,
           total_ratings_received = ?
       WHERE id = ?`,
      [reputation, positiveCount, negativeCount, ratings.length, userId]
    );
    
    logger.info(`Обновлена репутация пользователя ${userId}: ${reputation} (+ ${positiveCount}, - ${negativeCount})`);
  }
  
  /**
   * Проверка порога отрицательных оценок
   * @param userId ID пользователя
   */
  private async checkNegativeRatingsThreshold(userId: number): Promise<void> {
    try {
      // Получаем настройки порога
      const settings = await this.systemSettingsRepository.getSettings();
      const threshold = settings.negativeRatingsThreshold;
      
      // Получаем пользователя
      const user = await this.userRepository.findById(userId);
      
      // Если репутация меньше порога, исключаем пользователя
      if (user.reputation <= -threshold) {
        logger.warn(`Пользователь ${user.minecraftNickname} исключен из-за низкой репутации`, {
          userId,
          reputation: user.reputation,
          threshold: -threshold
        });
        
        // Меняем роль на заявителя
        await this.userRepository.updateRole(userId, UserRole.APPLICANT);
        
        // Убираем право голосовать
        await this.userRepository.updateCanVote(userId, false);
        
        // Удаляем из белого списка сервера
        let removedFromWhitelist = false;
        if (user.minecraftUUID) {
          removedFromWhitelist = await this.minecraftService.removeFromWhitelist(user.minecraftNickname, user.minecraftUUID);
        }
        
        // Если бот инициализирован, отправляем уведомления
        if (this.bot !== null) {
          // Уведомление пользователю
          try {
            await this.bot.api.sendMessage(
              user.telegramId,
              `⚠️ Вы исключены из сообщества из-за низкой репутации.\n\n` +
              `Ваша текущая репутация: ${user.reputation}\n` +
              `Порог для исключения: ${-threshold}\n\n` +
              `${removedFromWhitelist ? 'Вы удалены из белого списка сервера.' : 'Возникли проблемы с удалением из белого списка.'}\n\n` +
              `Вы можете подать новую заявку на вступление после исправления проблем, которые привели к негативным оценкам.`
            );
          } catch (error) {
            logger.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
          }
          
          // Уведомление администраторам
          try {
            const admins = await this.userRepository.findAdmins();
            
            for (const admin of admins) {
              await this.bot.api.sendMessage(
                admin.telegramId,
                `⚠️ Пользователь ${user.minecraftNickname} (${user.username ? '@' + user.username : 'без никнейма'}) ` +
                `автоматически исключен из сообщества из-за низкой репутации.\n\n` +
                `Репутация: ${user.reputation}\n` +
                `Порог для исключения: ${-threshold}\n\n` +
                `${removedFromWhitelist ? '✅ Пользователь удален из белого списка сервера.' : '⚠️ Не удалось удалить пользователя из белого списка сервера.'}`
              );
            }
          } catch (error) {
            logger.error('Ошибка при отправке уведомления администраторам:', error);
          }
        }
      }
    } catch (error) {
      logger.error('Ошибка при проверке порога отрицательных оценок', error);
    }
  }
  
  /**
   * Преобразование записи БД в объект Rating
   * @param dbRating Запись из БД
   */
  private mapDbToRating(dbRating: any): Rating {
    return {
      id: dbRating.id,
      targetUserId: dbRating.target_user_id,
      raterId: dbRating.rater_id,
      isPositive: Boolean(dbRating.is_positive),
      createdAt: new Date(dbRating.created_at)
    };
  }
  
  /**
   * Получение всех участников с их репутацией
   */
  async getAllMembersWithRatings(): Promise<User[]> {
    try {
      return await this.userRepository.findAllMembers();
    } catch (error) {
      logger.error('Ошибка при получении списка участников с репутацией', error);
      return [];
    }
  }
  
  /**
   * Получение детальной информации о рейтинге пользователя
   * @param userId ID пользователя
   * @returns Объект с количеством положительных и отрицательных оценок
   */
  async getUserRatingsDetails(userId: number): Promise<{ positiveCount: number; negativeCount: number }> {
    try {
      // Получаем информацию о пользователе
      const user = await this.userRepository.findById(userId);
      
      // Берем количество оценок напрямую из таблицы пользователей
      return { 
        positiveCount: user.positiveRatingsReceived || 0, 
        negativeCount: user.negativeRatingsReceived || 0 
      };
    } catch (error) {
      logger.error(`Ошибка при получении детальной информации о рейтинге пользователя ${userId}:`, error);
      return { positiveCount: 0, negativeCount: 0 };
    }
  }

  /**
   * Получение детальной информации об оценках пользователя
   * @param userId ID пользователя
   */
  async getRatingDetails(userId: number): Promise<RatingDetail[]> {
    const ratings = await executeQuery(
      `SELECT r.*, u.nickname as rater_nickname, u.username as rater_username
       FROM ratings r
       JOIN users u ON u.id = r.rater_id
       WHERE r.target_user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return ratings.map(this.mapDbToRatingDetail);
  }

  /**
   * Преобразование записи из БД в объект RatingDetail
   * @param dbRating Запись из БД
   */
  private mapDbToRatingDetail(dbRating: any): RatingDetail {
    return {
      id: dbRating.id,
      targetUserId: dbRating.target_user_id,
      raterId: dbRating.rater_id,
      isPositive: Boolean(dbRating.is_positive),
      raterNickname: dbRating.rater_nickname,
      raterUsername: dbRating.rater_username,
      reason: dbRating.reason,
      createdAt: new Date(dbRating.created_at)
    };
  }
}

// Создаем и экспортируем экземпляр сервиса оценок по умолчанию
export const ratingService = new RatingService();