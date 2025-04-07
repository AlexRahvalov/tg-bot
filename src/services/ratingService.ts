import { executeQuery } from '../db/connection';
import { logger } from '../utils/logger';
import { UserRepository } from '../db/repositories/userRepository';
import type { User, Rating } from '../models/types';
import { UserRole } from '../models/types';
import { MinecraftService } from './minecraftService';
import { SystemSettingsRepository } from '../db/repositories/systemSettingsRepository';

/**
 * Сервис для работы с оценками участников сообщества
 */
export class RatingService {
  private userRepository: UserRepository;
  private minecraftService: MinecraftService;
  private systemSettingsRepository: SystemSettingsRepository;
  
  constructor() {
    this.userRepository = new UserRepository();
    this.minecraftService = new MinecraftService();
    this.systemSettingsRepository = new SystemSettingsRepository();
  }
  
  /**
   * Добавление оценки участнику
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   * @param isPositive Положительная ли оценка
   */
  async addRating(raterUserId: number, targetUserId: number, isPositive: boolean): Promise<boolean> {
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
      
      // Проверка, что оцениваемый пользователь является участником
      const target = await this.userRepository.findById(targetUserId);
      if (target.role !== UserRole.MEMBER) {
        logger.warn('Попытка оценить не-участника', { targetUserId, role: target.role });
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
        await this.updateRating(existingRating.id, isPositive);
        await this.updateUserReputation(targetUserId);
        logger.info('Оценка обновлена', { raterUserId, targetUserId, isPositive });
        return true;
      }
      
      // Создаем новую оценку
      await this.createRating(raterUserId, targetUserId, isPositive);
      await this.updateUserReputation(targetUserId);
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
   * Создание новой оценки
   * @param raterUserId ID оценивающего пользователя
   * @param targetUserId ID оцениваемого пользователя
   * @param isPositive Положительная ли оценка
   */
  private async createRating(raterUserId: number, targetUserId: number, isPositive: boolean): Promise<number> {
    const result = await executeQuery(
      `INSERT INTO ratings (rater_id, target_user_id, is_positive) VALUES (?, ?, ?)`,
      [raterUserId, targetUserId, isPositive]
    );
    
    return result.insertId;
  }
  
  /**
   * Обновление существующей оценки
   * @param ratingId ID оценки
   * @param isPositive Новое значение оценки
   */
  private async updateRating(ratingId: number, isPositive: boolean): Promise<void> {
    await executeQuery(
      `UPDATE ratings SET is_positive = ? WHERE id = ?`,
      [isPositive, ratingId]
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
    
    for (const rating of ratings) {
      reputation += rating.is_positive ? 1 : -1;
    }
    
    // Обновляем репутацию пользователя в БД
    await executeQuery(
      `UPDATE users SET reputation = ? WHERE id = ?`,
      [reputation, userId]
    );
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
        if (user.minecraftUUID) {
          await this.minecraftService.removeFromWhitelist(user.minecraftNickname, user.minecraftUUID);
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
}

// Создаем и экспортируем экземпляр сервиса оценок по умолчанию
export const ratingService = new RatingService(); 