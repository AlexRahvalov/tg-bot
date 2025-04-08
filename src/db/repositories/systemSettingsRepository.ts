import { executeQuery } from '../connection';
import type { SystemSettings } from '../../models/types';
import { logger } from '../../utils/logger';

/**
 * Интерфейс для объекта с настройками в формате ключ-значение
 */
interface SettingsMap {
  [key: string]: string;
}

/**
 * Репозиторий для работы с системными настройками
 */
export class SystemSettingsRepository {
  /**
   * Получение текущих системных настроек
   */
  async getSettings(): Promise<SystemSettings> {
    try {
      const result = await executeQuery('SELECT key_name, value FROM system_settings', []);
      
      if (result.length === 0) {
        // Если настройки не найдены, используем настройки по умолчанию
        logger.warn('Настройки не найдены в БД, возвращаем значения по умолчанию');
        return {
          votingDurationDays: 1,
          votingDurationHours: 0,
          votingDurationMinutes: 0,
          minVotesRequired: 3,
          negativeRatingsThreshold: 5,
          ratingCooldownMinutes: 60,
          maxDailyRatings: 10,
          minReputationForVoting: -5
        };
      }
      
      // Преобразуем результат запроса из формата "ключ-значение" в объект настроек
      const settingsMap = result.reduce((map: SettingsMap, row: { key_name: string; value: string }) => {
        map[row.key_name] = row.value;
        return map;
      }, {});
      
      // Формируем объект настроек
      return {
        votingDurationDays: parseInt(settingsMap['voting_duration_days'] || '0', 10),
        votingDurationHours: parseInt(settingsMap['voting_duration_hours'] || '24', 10),
        votingDurationMinutes: parseInt(settingsMap['voting_duration_minutes'] || '0', 10),
        minVotesRequired: parseInt(settingsMap['min_votes_required'] || '3', 10),
        negativeRatingsThreshold: parseInt(settingsMap['negative_ratings_threshold'] || '5', 10),
        ratingCooldownMinutes: parseInt(settingsMap['rating_cooldown_minutes'] || '60', 10),
        maxDailyRatings: parseInt(settingsMap['max_daily_ratings'] || '10', 10),
        minReputationForVoting: parseInt(settingsMap['min_reputation_for_voting'] || '-5', 10)
      };
    } catch (error) {
      logger.error('Ошибка при получении системных настроек:', error);
      // Возвращаем настройки по умолчанию в случае ошибки
      return {
        votingDurationDays: 1,
        votingDurationHours: 0,
        votingDurationMinutes: 0,
        minVotesRequired: 3,
        negativeRatingsThreshold: 5,
        ratingCooldownMinutes: 60,
        maxDailyRatings: 10,
        minReputationForVoting: -5
      };
    }
  }

  /**
   * Обновление настроек продолжительности голосования
   * @param days Дни
   * @param hours Часы
   * @param minutes Минуты
   */
  async updateVotingDuration(days: number, hours: number, minutes: number): Promise<void> {
    try {
      // Нормализуем значения (переносим минуты в часы, часы в дни)
      let totalMinutes = minutes;
      let totalHours = hours;
      let totalDays = days;
      
      // Если минуты больше 59, переносим в часы
      if (totalMinutes >= 60) {
        totalHours += Math.floor(totalMinutes / 60);
        totalMinutes = totalMinutes % 60;
      }
      
      // Если часы больше 23, переносим в дни
      if (totalHours >= 24) {
        totalDays += Math.floor(totalHours / 24);
        totalHours = totalHours % 24;
      }
      
      // Обновляем настройки по ключам
      await executeQuery(
        'UPDATE system_settings SET value = ? WHERE key_name = ?',
        [totalDays.toString(), 'voting_duration_days']
      );
      
      await executeQuery(
        'UPDATE system_settings SET value = ? WHERE key_name = ?',
        [totalHours.toString(), 'voting_duration_hours']
      );
      
      await executeQuery(
        'UPDATE system_settings SET value = ? WHERE key_name = ?',
        [totalMinutes.toString(), 'voting_duration_minutes']
      );
      
      logger.info(`Обновлены настройки продолжительности голосования: ${totalDays} дней, ${totalHours} часов, ${totalMinutes} минут`);
    } catch (error) {
      logger.error('Ошибка при обновлении настроек продолжительности голосования:', error);
      throw error;
    }
  }

  /**
   * Получение продолжительности голосования в формате дни.часы.минуты
   */
  async getVotingDurationFormatted(): Promise<{ days: number; hours: number; minutes: number }> {
    const settings = await this.getSettings();
    
    return {
      days: settings.votingDurationDays,
      hours: settings.votingDurationHours,
      minutes: settings.votingDurationMinutes
    };
  }

  /**
   * Обновление минимального количества голосов
   * @param count Новое минимальное количество голосов
   */
  async updateMinVotesRequired(count: number): Promise<void> {
    try {
      await executeQuery(
        'UPDATE system_settings SET value = ? WHERE key_name = ?',
        [count.toString(), 'min_votes_required']
      );
      
      logger.info(`Обновлена настройка минимального количества голосов: ${count}`);
    } catch (error) {
      logger.error('Ошибка при обновлении настройки минимального количества голосов:', error);
      throw error;
    }
  }

  /**
   * Обновление порога отрицательных оценок
   * @param threshold Новый порог
   */
  async updateNegativeRatingsThreshold(threshold: number): Promise<void> {
    try {
      await executeQuery(
        'UPDATE system_settings SET value = ? WHERE key_name = ?',
        [threshold.toString(), 'negative_ratings_threshold']
      );
      
      logger.info(`Обновлена настройка порога отрицательных оценок: ${threshold}`);
    } catch (error) {
      logger.error('Ошибка при обновлении настройки порога отрицательных оценок:', error);
      throw error;
    }
  }
} 