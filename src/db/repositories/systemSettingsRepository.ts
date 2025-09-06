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
    const result = await executeQuery('SELECT key_name, value FROM system_settings', []);
    
    if (result.length === 0) {
      // Если настройки не найдены, используем настройки по умолчанию
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
    
    // Преобразуем массив key-value в объект
    const settings: Record<string, string> = {};
    result.forEach((row: any) => {
      settings[row.key_name] = row.value;
    });
    
    return {
      votingDurationDays: parseInt(settings.voting_duration_days || '1'),
      votingDurationHours: parseInt(settings.voting_duration_hours || '0'),
      votingDurationMinutes: parseInt(settings.voting_duration_minutes || '0'),
      minVotesRequired: parseInt(settings.min_votes_required || '3'),
      negativeRatingsThreshold: parseInt(settings.negative_ratings_threshold || '5'),
      ratingCooldownMinutes: parseInt(settings.rating_cooldown_minutes || '60'),
      maxDailyRatings: parseInt(settings.max_daily_ratings || '10'),
      minReputationForVoting: parseInt(settings.min_reputation_for_voting || '-5')
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
    
    // Обновляем каждую настройку отдельно в key-value структуре
    await executeQuery(
      `UPDATE system_settings SET value = ? WHERE key_name = ?`,
      [totalDays.toString(), 'voting_duration_days']
    );
    
    await executeQuery(
      `UPDATE system_settings SET value = ? WHERE key_name = ?`,
      [totalHours.toString(), 'voting_duration_hours']
    );
    
    await executeQuery(
      `UPDATE system_settings SET value = ? WHERE key_name = ?`,
      [totalMinutes.toString(), 'voting_duration_minutes']
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
      'UPDATE system_settings SET value = ? WHERE key_name = ?',
      [count.toString(), 'min_votes_required']
    );
  }

  /**
   * Обновление порога негативных оценок
   * @param threshold Новый порог негативных оценок
   */
  async updateNegativeRatingsThreshold(threshold: number): Promise<void> {
    await executeQuery(
      'UPDATE system_settings SET value = ? WHERE key_name = ?',
      [threshold.toString(), 'negative_ratings_threshold']
    );
  }
}