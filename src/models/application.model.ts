import { executeQuery } from '../database/connection';

/**
 * Статусы заявок
 */
export enum ApplicationStatus {
  PENDING = 'pending',        // На голосовании
  APPROVED = 'approved',      // Одобрена
  REJECTED = 'rejected',      // Отклонена
  EXPIRED = 'expired',        // Просрочена (не набрала нужного количества голосов)
  BANNED = 'banned'           // Заблокирована
}

/**
 * Интерфейс заявки
 */
export interface Application {
  id?: number | string;       // ID в базе данных - может быть string для обработки больших чисел
  userId: number;             // ID пользователя из таблицы users
  telegramId: number;         // ID пользователя в Telegram
  minecraftUsername: string;  // Имя в Minecraft
  minecraftUUID?: string;     // UUID в Minecraft
  reason: string;             // Причина заявки
  status: ApplicationStatus;  // Статус заявки
  votingEndsAt: Date;         // Дата окончания голосования
  votesPositive: number;      // Количество положительных голосов
  votesNegative: number;      // Количество отрицательных голосов
  created: Date;              // Дата создания
  updated?: Date;             // Дата обновления
}

/**
 * Класс для работы с заявками
 */
export class ApplicationModel {
  /**
   * Получение заявки по ID
   * @param id - ID заявки
   * @returns Заявка или null, если не найдена
   */
  static async getById(id: number | string): Promise<Application | null> {
    const applications = await executeQuery<Application[]>(
      'SELECT * FROM applications WHERE id = ?',
      [id]
    );
    
    return applications.length > 0 ? applications[0] : null;
  }

  /**
   * Получение последней заявки пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Последняя заявка или null, если не найдена
   */
  static async getLastByTelegramId(telegramId: number): Promise<Application | null> {
    const applications = await executeQuery<Application[]>(
      'SELECT * FROM applications WHERE telegramId = ? ORDER BY created DESC LIMIT 1',
      [telegramId]
    );
    
    return applications.length > 0 ? applications[0] : null;
  }

  /**
   * Создание новой заявки
   * @param application - Данные заявки
   * @returns Созданная заявка
   */
  static async create(application: Omit<Application, 'id' | 'status' | 'votesPositive' | 'votesNegative' | 'created' | 'updated'>): Promise<Application> {
    const now = new Date();
    
    const result = await executeQuery<{insertId: number}>(
      `INSERT INTO applications 
      (userId, telegramId, minecraftUsername, reason, status, votingEndsAt, votesPositive, votesNegative, created) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        application.userId,
        application.telegramId,
        application.minecraftUsername,
        application.reason,
        ApplicationStatus.PENDING,  // Начальный статус всегда "На голосовании"
        application.votingEndsAt,
        0,  // Начальное количество положительных голосов
        0,  // Начальное количество отрицательных голосов
        now
      ]
    );
    
    return {
      id: result.insertId,
      ...application,
      status: ApplicationStatus.PENDING,
      votesPositive: 0,
      votesNegative: 0,
      created: now
    };
  }

  /**
   * Обновление статуса заявки
   * @param id - ID заявки
   * @param status - Новый статус
   * @returns true, если обновление успешно
   */
  static async updateStatus(id: number | string, status: ApplicationStatus): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'UPDATE applications SET status = ?, updated = ? WHERE id = ?',
      [status, new Date(), id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Добавление голоса к заявке
   * @param id - ID заявки
   * @param isPositive - Положительный или отрицательный голос
   * @returns true, если обновление успешно
   */
  static async addVote(id: number | string, isPositive: boolean): Promise<boolean> {
    const field = isPositive ? 'votesPositive' : 'votesNegative';
    
    const result = await executeQuery<{affectedRows: number}>(
      `UPDATE applications SET ${field} = ${field} + 1, updated = ? WHERE id = ?`,
      [new Date(), id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Обновление счетчиков голосов в заявке
   * @param id - ID заявки
   * @param votesPositive - Количество положительных голосов
   * @param votesNegative - Количество отрицательных голосов
   * @returns true, если обновление успешно
   */
  static async updateVoteCounts(id: number | string, votesPositive: number, votesNegative: number): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      `UPDATE applications SET votesPositive = ?, votesNegative = ?, updated = ? WHERE id = ?`,
      [votesPositive, votesNegative, new Date(), id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Получение списка активных заявок
   * @returns Массив активных заявок
   */
  static async getActiveApplications(): Promise<Application[]> {
    return executeQuery<Application[]>(
      'SELECT * FROM applications WHERE status = ? AND votingEndsAt > ?',
      [ApplicationStatus.PENDING, new Date()]
    );
  }

  /**
   * Получение заявок с истекшим сроком голосования
   * @returns Массив заявок с истекшим сроком
   */
  static async getExpiredApplications(): Promise<Application[]> {
    return executeQuery<Application[]>(
      'SELECT * FROM applications WHERE status = ? AND votingEndsAt <= ?',
      [ApplicationStatus.PENDING, new Date()]
    );
  }

  /**
   * Обновление UUID Minecraft для заявки
   * @param id - ID заявки
   * @param uuid - UUID игрока
   * @returns true, если обновление успешно
   */
  static async updateMinecraftUUID(id: number | string, uuid: string): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'UPDATE applications SET minecraftUUID = ?, updated = ? WHERE id = ?',
      [uuid, new Date(), id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Получение количества заявок от пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Количество заявок
   */
  static async countByUser(telegramId: number): Promise<number> {
    try {
      const result = await executeQuery<{count: number}[]>(
        'SELECT COUNT(*) as count FROM applications WHERE telegramId = ?',
        [telegramId]
      );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Ошибка при подсчете заявок пользователя:', error);
      return 0;
    }
  }

  /**
   * Получение активной заявки пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Активная заявка или null, если не найдена
   */
  static async getActiveByUser(telegramId: number): Promise<Application | null> {
    try {
      const applications = await executeQuery<Application[]>(
        'SELECT * FROM applications WHERE telegramId = ? AND status = ? ORDER BY created DESC LIMIT 1',
        [telegramId, ApplicationStatus.PENDING]
      );
      
      return applications.length > 0 ? applications[0] : null;
    } catch (error) {
      console.error('Ошибка при получении активной заявки пользователя:', error);
      return null;
    }
  }

  /**
   * Получение всех заявок пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Массив заявок
   */
  static async getAllByUser(telegramId: number): Promise<Application[]> {
    try {
      return await executeQuery<Application[]>(
        'SELECT * FROM applications WHERE telegramId = ? ORDER BY created DESC',
        [telegramId]
      );
    } catch (error) {
      console.error('Ошибка при получении всех заявок пользователя:', error);
      return [];
    }
  }

  /**
   * Получение общего количества заявок
   * @returns Количество заявок
   */
  static async getApplicationCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM applications',
      []
    );
    return result[0]?.count ?? 0;
  }

  /**
   * Получение количества заявок со статусом "На рассмотрении"
   * @returns Количество заявок
   */
  static async getPendingApplicationCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM applications WHERE status = ?',
      [ApplicationStatus.PENDING]
    );
    return result[0]?.count ?? 0;
  }

  /**
   * Получение количества одобренных заявок
   * @returns Количество заявок
   */
  static async getApprovedApplicationCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM applications WHERE status = ?',
      [ApplicationStatus.APPROVED]
    );
    return result[0]?.count ?? 0;
  }

  /**
   * Получение количества отклоненных заявок
   * @returns Количество заявок
   */
  static async getRejectedApplicationCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM applications WHERE status = ? OR status = ?',
      [ApplicationStatus.REJECTED, ApplicationStatus.EXPIRED]
    );
    return result[0]?.count ?? 0;
  }
} 