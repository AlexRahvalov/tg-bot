import { executeQuery } from '../connection';
import type { SystemSettings } from '../../models/types';

/**
 * Репозиторий для работы с системными настройками
 */
export class SystemSettingsRepository {
  /**
   * Получение текущих системных настроек
   */
  async getSettings(): Promise<SystemSettings> {
    const result = await executeQuery('SELECT * FROM system_settings LIMIT 1', []);
    
    if (result.length === 0) {
      // Если настройки не найдены, используем настройки по умолчанию
      return {
        votingDurationDays: 1,
        votingDurationHours: 0,
        votingDurationMinutes: 0,
        minVotesRequired: 3,
        negativeRatingsThreshold: 5
      };
    }
    
    return {
      votingDurationDays: result[0].voting_duration_days || 0,
      votingDurationHours: result[0].voting_duration_hours || 0,
      votingDurationMinutes: result[0].voting_duration_minutes || 0,
      minVotesRequired: result[0].min_votes_required,
      negativeRatingsThreshold: result[0].negative_ratings_threshold
    };
  }

  /**
   * Обновление настроек продолжительности голосования
   * @param days Дни
   * @param hours Часы
   * @param minutes Минуты
   */
  async updateVotingDuration(days: number, hours: number, minutes: number): Promise<void> {
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
    
    await executeQuery(
      `UPDATE system_settings 
       SET voting_duration_days = ?,
           voting_duration_hours = ?,
           voting_duration_minutes = ?`,
      [totalDays, totalHours, totalMinutes]
    );
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
    await executeQuery(
      'UPDATE system_settings SET min_votes_required = ?',
      [count]
    );
  }

  /**
   * Обновление порога отрицательных оценок
   * @param threshold Новый порог
   */
  async updateNegativeRatingsThreshold(threshold: number): Promise<void> {
    await executeQuery(
      'UPDATE system_settings SET negative_ratings_threshold = ?',
      [threshold]
    );
  }
} 