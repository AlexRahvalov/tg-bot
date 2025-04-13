import { executeQuery } from '../../database/connection';
import { User, UserModel, UserRole } from '../user.model';
import { ReputationReason, ReputationReasonModel } from './reputation.reason.model';

/**
 * Интерфейс записи репутации
 */
export interface ReputationRecord {
  id?: number;
  voter_id: number;
  target_id: number;
  is_positive: boolean;
  reason_id?: number;
  vote_weight: number;
  created: Date;
}

/**
 * Расширенный интерфейс записи репутации с информацией о пользователях и причине
 */
export interface ReputationRecordDetailed extends ReputationRecord {
  voter?: User;
  target?: User;
  reason?: ReputationReason;
}

// Интерфейс для результата запроса из базы данных
interface ReputationRecordQueryResult {
  id: number;
  voter_id: number;
  target_id: number;
  is_positive: boolean;
  reason_id?: number;
  vote_weight: number;
  created: Date;
  voter_telegram_id?: number;
  voter_first_name?: string;
  voter_last_name?: string;
  voter_username?: string;
  voter_role?: string;
  voter_can_vote?: boolean;
  voter_created?: Date;
  target_telegram_id?: number;
  target_first_name?: string;
  target_last_name?: string;
  target_username?: string;
  target_role?: string;
  target_can_vote?: boolean;
  target_created?: Date;
  reason_name?: string;
  reason_description?: string;
  reason_is_positive?: boolean;
  reason_created?: Date;
}

/**
 * Класс для работы с записями репутации
 */
export class ReputationRecordModel {
  /**
   * Получение записей репутации пользователя
   * @param userId - ID пользователя
   * @param isPositive - Фильтр по типу (положительные/отрицательные/все)
   * @returns Массив записей репутации
   */
  static async getByUserId(userId: number, isPositive?: boolean): Promise<ReputationRecord[]> {
    let query = 'SELECT * FROM user_reputation_records WHERE target_id = ?';
    const params: any[] = [userId];
    
    if (isPositive !== undefined) {
      query += ' AND is_positive = ?';
      params.push(isPositive);
    }
    
    query += ' ORDER BY created DESC';
    
    return executeQuery<ReputationRecord[]>(query, params);
  }

  /**
   * Получение расширенных записей репутации пользователя
   * @param userId - ID пользователя
   * @param isPositive - Фильтр по типу (положительные/отрицательные/все)
   * @returns Массив расширенных записей репутации
   */
  static async getDetailedByUserId(userId: number, isPositive?: boolean): Promise<ReputationRecordDetailed[]> {
    let query = `
      SELECT 
        r.*,
        uv.telegramId as voter_telegram_id,
        uv.firstName as voter_first_name,
        uv.lastName as voter_last_name,
        uv.username as voter_username,
        uv.role as voter_role,
        uv.canVote as voter_can_vote,
        uv.created as voter_created,
        ut.telegramId as target_telegram_id,
        ut.firstName as target_first_name,
        ut.lastName as target_last_name,
        ut.username as target_username,
        ut.role as target_role,
        ut.canVote as target_can_vote,
        ut.created as target_created,
        rr.name as reason_name,
        rr.description as reason_description,
        rr.is_positive as reason_is_positive,
        rr.created as reason_created
      FROM user_reputation_records r
      LEFT JOIN users uv ON r.voter_id = uv.id
      LEFT JOIN users ut ON r.target_id = ut.id
      LEFT JOIN reputation_reasons rr ON r.reason_id = rr.id
      WHERE r.target_id = ?
    `;
    const params: any[] = [userId];
    
    if (isPositive !== undefined) {
      query += ' AND r.is_positive = ?';
      params.push(isPositive);
    }
    
    query += ' ORDER BY r.created DESC';
    
    const results = await executeQuery<ReputationRecordQueryResult[]>(query, params);
    
    // Преобразование результатов в расширенный формат
    return results.map((record: ReputationRecordQueryResult) => {
      const detailed: ReputationRecordDetailed = {
        id: record.id,
        voter_id: record.voter_id,
        target_id: record.target_id,
        is_positive: record.is_positive,
        reason_id: record.reason_id,
        vote_weight: record.vote_weight,
        created: record.created
      };
      
      // Добавление данных голосующего пользователя
      if (record.voter_telegram_id) {
        detailed.voter = {
          id: record.voter_id,
          telegramId: record.voter_telegram_id,
          firstName: record.voter_first_name || '',
          lastName: record.voter_last_name,
          username: record.voter_username,
          role: this.parseUserRole(record.voter_role),
          canVote: record.voter_can_vote || false,
          created: record.voter_created || new Date()
        };
      }
      
      // Добавление данных пользователя, за которого голосуют
      if (record.target_telegram_id) {
        detailed.target = {
          id: record.target_id,
          telegramId: record.target_telegram_id,
          firstName: record.target_first_name || '',
          lastName: record.target_last_name,
          username: record.target_username,
          role: this.parseUserRole(record.target_role),
          canVote: record.target_can_vote || false,
          created: record.target_created || new Date()
        };
      }
      
      // Добавление данных о причине
      if (record.reason_name) {
        detailed.reason = {
          id: record.reason_id,
          name: record.reason_name,
          description: record.reason_description,
          is_positive: record.reason_is_positive || false,
          created: record.reason_created || new Date()
        };
      }
      
      return detailed;
    });
  }

  /**
   * Преобразование строки роли в enum UserRole
   * @param role - Строковое представление роли
   * @returns Значение enum UserRole
   */
  private static parseUserRole(role?: string): UserRole {
    if (!role) return UserRole.NEW;
    
    switch (role) {
      case 'admin': return UserRole.ADMIN;
      case 'member': return UserRole.MEMBER;
      case 'guest': return UserRole.GUEST;
      default: return UserRole.NEW;
    }
  }

  /**
   * Создание новой записи репутации
   * @param record - Данные записи репутации
   * @returns Созданная запись репутации
   */
  static async create(record: Omit<ReputationRecord, 'id' | 'created'>): Promise<ReputationRecord> {
    const now = new Date();
    
    const result = await executeQuery<{insertId: number}>(
      `INSERT INTO user_reputation_records
      (voter_id, target_id, is_positive, reason_id, vote_weight, created)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.voter_id,
        record.target_id,
        record.is_positive,
        record.reason_id || null,
        record.vote_weight,
        now
      ]
    );
    
    return {
      id: result.insertId,
      ...record,
      created: now
    };
  }

  /**
   * Удаление записи репутации
   * @param id - ID записи репутации
   * @returns true, если удаление успешно
   */
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'DELETE FROM user_reputation_records WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Проверка, голосовал ли пользователь за другого пользователя
   * @param voterId - ID голосующего пользователя
   * @param targetId - ID пользователя, за которого голосуют
   * @returns true, если пользователь уже голосовал
   */
  static async hasUserVoted(voterId: number, targetId: number): Promise<boolean> {
    const records = await executeQuery<ReputationRecord[]>(
      'SELECT * FROM user_reputation_records WHERE voter_id = ? AND target_id = ?',
      [voterId, targetId]
    );
    
    return records.length > 0;
  }

  /**
   * Получение количества записей репутации пользователя по типу
   * @param userId - ID пользователя
   * @returns Объект с количеством положительных и отрицательных записей
   */
  static async countByUserId(userId: number): Promise<{positive: number, negative: number, weighted_positive: number, weighted_negative: number}> {
    const result = await executeQuery<any[]>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_positive = TRUE THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN is_positive = FALSE THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN is_positive = TRUE THEN vote_weight ELSE 0 END) as positive_weight,
        SUM(CASE WHEN is_positive = FALSE THEN vote_weight ELSE 0 END) as negative_weight
      FROM user_reputation_records 
      WHERE target_id = ?`,
      [userId]
    );
    
    return {
      positive: result[0]?.positive_count || 0,
      negative: result[0]?.negative_count || 0,
      weighted_positive: result[0]?.positive_weight || 0,
      weighted_negative: result[0]?.negative_weight || 0
    };
  }

  /**
   * Обновление репутации пользователя в таблице users на основе записей
   * @param userId - ID пользователя
   * @returns true, если обновление успешно
   */
  static async updateUserReputation(userId: number): Promise<boolean> {
    const counts = await this.countByUserId(userId);
    
    const result = await executeQuery<{affectedRows: number}>(
      `UPDATE users 
      SET reputation_positive = ?,
          reputation_negative = ?,
          updated = ?
      WHERE id = ?`,
      [counts.weighted_positive, counts.weighted_negative, new Date(), userId]
    );

    return result.affectedRows > 0;
  }
} 