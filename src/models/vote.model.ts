import { executeQuery } from '../database/connection';

/**
 * Типы голосов
 */
export enum VoteType {
  POSITIVE = 'positive',  // Положительный голос
  NEGATIVE = 'negative'   // Отрицательный голос
}

/**
 * Интерфейс голоса
 */
export interface Vote {
  id?: number | string;           // ID в базе данных - может быть string для обработки BigInt
  applicationId: number | string; // ID заявки - может быть string для обработки BigInt
  userId: number;                 // ID пользователя, который голосует
  voteType: VoteType;             // Тип голоса
  created: Date;                  // Дата создания
}

/**
 * Класс для работы с голосами
 */
export class VoteModel {
  /**
   * Проверка, голосовал ли пользователь за заявку
   * @param userId - ID пользователя
   * @param applicationId - ID заявки
   * @returns true, если пользователь уже голосовал
   */
  static async hasUserVoted(userId: number, applicationId: number | string): Promise<boolean> {
    const votes = await executeQuery<Vote[]>(
      'SELECT * FROM votes WHERE userId = ? AND applicationId = ?',
      [userId, applicationId]
    );
    
    return votes.length > 0;
  }

  /**
   * Добавление голоса
   * @param vote - Данные голоса
   * @returns Созданный голос
   */
  static async create(vote: Omit<Vote, 'id' | 'created'>): Promise<Vote> {
    const now = new Date();
    
    const result = await executeQuery<{insertId: number}>(
      'INSERT INTO votes (applicationId, userId, voteType, created) VALUES (?, ?, ?, ?)',
      [vote.applicationId, vote.userId, vote.voteType, now]
    );
    
    return {
      id: result.insertId,
      ...vote,
      created: now
    };
  }

  /**
   * Получение всех голосов по заявке
   * @param applicationId - ID заявки
   * @returns Массив голосов
   */
  static async getByApplicationId(applicationId: number): Promise<Vote[]> {
    return executeQuery<Vote[]>(
      'SELECT * FROM votes WHERE applicationId = ?',
      [applicationId]
    );
  }

  /**
   * Подсчет голосов по заявке
   * @param applicationId - ID заявки
   * @returns Объект с количеством положительных и отрицательных голосов
   */
  static async countVotes(applicationId: number | string): Promise<{positive: number, negative: number}> {
    const positiveVotes = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM votes WHERE applicationId = ? AND voteType = ?',
      [applicationId, VoteType.POSITIVE]
    );
    
    const negativeVotes = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM votes WHERE applicationId = ? AND voteType = ?',
      [applicationId, VoteType.NEGATIVE]
    );
    
    return {
      positive: positiveVotes[0]?.count ?? 0,
      negative: negativeVotes[0]?.count ?? 0
    };
  }
} 