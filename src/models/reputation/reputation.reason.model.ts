import { executeQuery } from '../../database/connection';

/**
 * Интерфейс причины репутации
 */
export interface ReputationReason {
  id?: number;
  name: string;
  description?: string;
  is_positive: boolean;
  created: Date;
}

/**
 * Класс для работы с причинами репутации
 */
export class ReputationReasonModel {
  /**
   * Получение всех причин репутации
   * @param isPositive - Фильтр по типу (положительные/отрицательные)
   * @returns Массив причин репутации
   */
  static async getAll(isPositive?: boolean): Promise<ReputationReason[]> {
    let query = 'SELECT * FROM reputation_reasons';
    const params: any[] = [];
    
    if (isPositive !== undefined) {
      query += ' WHERE is_positive = ?';
      params.push(isPositive);
    }
    
    query += ' ORDER BY name';
    
    return executeQuery<ReputationReason[]>(query, params);
  }

  /**
   * Получение причины репутации по ID
   * @param id - ID причины репутации
   * @returns Причина репутации или null, если не найдена
   */
  static async getById(id: number): Promise<ReputationReason | null> {
    const reasons = await executeQuery<ReputationReason[]>(
      'SELECT * FROM reputation_reasons WHERE id = ?',
      [id]
    );
    
    return reasons.length > 0 ? reasons[0] : null;
  }

  /**
   * Создание новой причины репутации
   * @param reason - Данные причины репутации
   * @returns Созданная причина репутации
   */
  static async create(reason: Omit<ReputationReason, 'id' | 'created'>): Promise<ReputationReason> {
    const now = new Date();
    
    const result = await executeQuery<{insertId: number}>(
      'INSERT INTO reputation_reasons (name, description, is_positive, created) VALUES (?, ?, ?, ?)',
      [reason.name, reason.description || null, reason.is_positive, now]
    );
    
    return {
      id: result.insertId,
      ...reason,
      created: now
    };
  }

  /**
   * Обновление причины репутации
   * @param id - ID причины репутации
   * @param reason - Новые данные причины репутации
   * @returns true, если обновление успешно
   */
  static async update(id: number, reason: Partial<ReputationReason>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    // Формирование запроса динамически на основе предоставленных полей
    Object.entries(reason).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    // Добавление id в конец массива для WHERE
    values.push(id);

    const result = await executeQuery<{affectedRows: number}>(
      `UPDATE reputation_reasons SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * Удаление причины репутации
   * @param id - ID причины репутации
   * @returns true, если удаление успешно
   */
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'DELETE FROM reputation_reasons WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
} 