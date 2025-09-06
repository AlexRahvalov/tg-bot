import { executeQuery, getConnection } from '../connection';
import { VoteType, type Vote, type Vote as VoteInterface, type CreateVoteRequest } from '../../models/types';
import type { PoolConnection } from 'mariadb';
import { logger } from '../../utils/logger';
import { voteCache, applicationCache, CacheUtils } from '../../utils/cache';

/**
 * Retry-логика для операций с базой данных
 */
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Проверяем, стоит ли повторять операцию
      if (!shouldRetry(error as Error) || attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`Попытка ${attempt}/${maxRetries} неудачна, повтор через ${delay}мс:`, error);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
};

/**
 * Определяет, стоит ли повторять операцию при данной ошибке
 */
const shouldRetry = (error: Error): boolean => {
  const errorMessage = error.message.toLowerCase();
  
  // Повторяем при временных проблемах с соединением
  if (errorMessage.includes('connection') || 
      errorMessage.includes('timeout') ||
      errorMessage.includes('lock wait timeout') ||
      errorMessage.includes('deadlock')) {
    return true;
  }
  
  // Не повторяем при логических ошибках
  if (errorMessage.includes('duplicate') ||
      errorMessage.includes('constraint') ||
      errorMessage.includes('foreign key')) {
    return false;
  }
  
  return false;
};

/**
 * Специальные типы ошибок для голосования
 */
export class VoteError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'VoteError';
  }
}

export class DuplicateVoteError extends VoteError {
  constructor() {
    super('Пользователь уже проголосовал за эту заявку', 'DUPLICATE_VOTE');
  }
}

export class ApplicationNotFoundError extends VoteError {
  constructor() {
    super('Заявка не найдена', 'APPLICATION_NOT_FOUND');
  }
}

// Используем импортированный интерфейс VoteInterface

interface VoteCounts {
  positive: number;
  negative: number;
}

/**
 * Репозиторий для работы с голосами
 */
export class VoteRepository {
  
  /**
   * Добавляет голос с транзакционной безопасностью и retry-логикой
   */
  async addVote(vote: CreateVoteRequest): Promise<void> {
    return retryOperation(async () => {
      let conn: PoolConnection | null = null;
      try {
        conn = await getConnection();
        await conn.beginTransaction();
        
        // Проверяем существование заявки
        const applicationExists = await conn.query(
          `SELECT id FROM applications WHERE id = ?`,
          [vote.applicationId]
        );
        
        if (applicationExists.length === 0) {
          throw new ApplicationNotFoundError();
        }
        
        // Проверяем, не голосовал ли уже пользователь (с блокировкой для предотвращения race condition)
        const existingVote = await conn.query(
          `SELECT id FROM votes 
           WHERE application_id = ? AND voter_id = ? 
           FOR UPDATE`,
          [vote.applicationId, vote.voterId]
        );
        
        if (existingVote.length > 0) {
          throw new DuplicateVoteError();
        }
         
         // Добавляем голос (счетчики обновятся автоматически через триггеры БД)
          const result = await conn.query(
            `INSERT INTO votes (application_id, voter_id, vote_type, created_at)
             VALUES (?, ?, ?, NOW())`,
            [vote.applicationId, vote.voterId, vote.voteType]
          );
         
         await conn.commit();
         
         // Инвалидируем связанные кэши
         CacheUtils.invalidateVoteCaches(vote.applicationId, vote.voterId);
         
         logger.info(`Голос успешно добавлен: пользователь ${vote.voterId}, заявка ${vote.applicationId}, тип ${vote.voteType}`);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (rollbackError) {
            logger.error('Ошибка при откате транзакции:', rollbackError);
          }
        }
        
        // Логируем ошибку с контекстом
        logger.error('Ошибка при добавлении голоса:', {
          error: error,
          vote: vote,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      } finally {
        if (conn) {
          conn.release();
        }
      }
    });
  }
  
  /**
   * Проверяет, голосовал ли пользователь за заявку
   */
  async hasVoted(applicationId: number, userId: number): Promise<boolean> {
    try {
      const result = await executeQuery(
        `SELECT COUNT(*) as count
         FROM votes
         WHERE application_id = ? AND voter_id = ?`,
        [applicationId, userId]
      );
      
      return result[0].count > 0;
    } catch (error) {
      console.error('Ошибка при проверке голоса:', error);
      throw error;
    }
  }
  
  /**
   * Подсчитывает количество положительных и отрицательных голосов
   */
  async countVotes(applicationId: number): Promise<VoteCounts> {
    try {
      const result = await executeQuery(
        `SELECT 
           SUM(CASE WHEN vote_type = 'POSITIVE' THEN 1 ELSE 0 END) as positive,
           SUM(CASE WHEN vote_type = 'NEGATIVE' THEN 1 ELSE 0 END) as negative
         FROM votes
         WHERE application_id = ?`,
        [applicationId]
      );
      
      return {
        positive: parseInt(result[0].positive) || 0,
        negative: parseInt(result[0].negative) || 0
      };
    } catch (error) {
      console.error('Ошибка при подсчете голосов:', error);
      throw error;
    }
  }
  
  /**
   * Удаляет все голоса для заявки с транзакционной безопасностью
   */
  async deleteVotes(applicationId: number): Promise<void> {
    let conn: PoolConnection | null = null;
    try {
      conn = await getConnection();
      await conn.beginTransaction();
      
      // Удаляем голоса (счетчики обновятся автоматически через триггеры БД)
      await conn.query(
        `DELETE FROM votes WHERE application_id = ?`,
        [applicationId]
      );
      
      await conn.commit();
    } catch (error) {
      if (conn) {
        await conn.rollback();
      }
      console.error('Ошибка при удалении голосов:', error);
      throw error;
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
  
  /**
   * Удаляет конкретный голос пользователя с транзакционной безопасностью
   */
  async deleteVote(applicationId: number, voterId: number): Promise<boolean> {
    let conn: PoolConnection | null = null;
    try {
      conn = await getConnection();
      await conn.beginTransaction();
      
      // Удаляем голос (счетчики обновятся автоматически через триггеры БД)
      const result = await conn.query(
        `DELETE FROM votes 
         WHERE application_id = ? AND voter_id = ?`,
        [applicationId, voterId]
      );
      
      await conn.commit();
      return result.affectedRows > 0;
    } catch (error) {
      if (conn) {
        await conn.rollback();
      }
      console.error('Ошибка при удалении голоса:', error);
      throw error;
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
  
  /**
   * Удаляет голос с транзакционной безопасностью и retry-логикой
   */
  async removeVote(applicationId: number, voterId: number): Promise<void> {
    return retryOperation(async () => {
      let conn: PoolConnection | null = null;
      try {
        conn = await getConnection();
        await conn.beginTransaction();
        
        // Проверяем существование заявки
        const applicationExists = await conn.query(
          `SELECT id FROM applications WHERE id = ?`,
          [applicationId]
        );
        
        if (applicationExists.length === 0) {
          throw new ApplicationNotFoundError();
        }
        
        // Удаляем голос (счетчики обновятся автоматически через триггеры БД)
        const result = await conn.query(
          `DELETE FROM votes 
           WHERE application_id = ? AND voter_id = ?`,
          [applicationId, voterId]
        );
        
        if (result.affectedRows === 0) {
          throw new VoteError('Голос не найден или уже удален', 'VOTE_NOT_FOUND');
        }
        
        await conn.commit();
         
         // Инвалидируем связанные кэши
         CacheUtils.invalidateVoteCaches(applicationId, voterId);
         
         logger.info(`Голос успешно удален: пользователь ${voterId}, заявка ${applicationId}`);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (rollbackError) {
            logger.error('Ошибка при откате транзакции:', rollbackError);
          }
        }
        
        // Логируем ошибку с контекстом
        logger.error('Ошибка при удалении голоса:', {
          error: error,
          applicationId: applicationId,
          voterId: voterId,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      } finally {
        if (conn) {
          conn.release();
        }
      }
    });
  }
  
  /**
   * Находит всех пользователей, проголосовавших за заявку
   */
  async findVotersByApplication(applicationId: number): Promise<number[]> {
    try {
      const result = await executeQuery(
        `SELECT voter_id
         FROM votes
         WHERE application_id = ?`,
        [applicationId]
      );
      
      return result.map((row: { voter_id: number }) => row.voter_id);
    } catch (error) {
      console.error('Ошибка при поиске проголосовавших пользователей:', error);
      throw error;
    }
  }
  
  /**
   * Получает все голоса по заявке
   */
  async getVotesByApplication(applicationId: number): Promise<VoteInterface[]> {
    return retryOperation(async () => {
      try {
        // Проверяем существование заявки
        const applicationExists = await executeQuery(
          `SELECT id FROM applications WHERE id = ?`,
          [applicationId]
        );
        
        if (applicationExists.length === 0) {
          throw new ApplicationNotFoundError();
        }
        
        const rows = await executeQuery(
          `SELECT id, application_id, voter_id, vote_type, created_at 
           FROM votes 
           WHERE application_id = ? 
           ORDER BY created_at DESC`,
          [applicationId]
        );
        
        const votes = rows.map((row: any) => ({
          id: row.id,
          applicationId: row.application_id,
          voterId: row.voter_id,
          voteType: row.vote_type === 'positive' ? VoteType.POSITIVE : VoteType.NEGATIVE,
          createdAt: row.created_at
        }));
        
        logger.debug(`Получено ${votes.length} голосов для заявки ${applicationId}`);
        return votes;
      } catch (error) {
        logger.error('Ошибка при получении голосов по заявке:', {
          error: error,
          applicationId: applicationId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  }
  
  /**
   * Получает голос конкретного пользователя по заявке (с кэшированием)
   */
  async getUserVote(applicationId: number, voterId: number): Promise<VoteInterface | null> {
    const cacheKey = CacheUtils.userVoteKey(applicationId, voterId);
    
    return voteCache.getOrSet(cacheKey, async () => {
      return retryOperation(async () => {
        try {
          // Проверяем существование заявки
          const applicationExists = await executeQuery(
            `SELECT id FROM applications WHERE id = ?`,
            [applicationId]
          );
          
          if (applicationExists.length === 0) {
            throw new ApplicationNotFoundError();
          }
          
          const rows = await executeQuery(
            `SELECT id, application_id, voter_id, vote_type, created_at 
             FROM votes 
             WHERE application_id = ? AND voter_id = ?`,
            [applicationId, voterId]
          );
          
          if (rows.length === 0) {
            logger.debug(`Голос не найден: пользователь ${voterId}, заявка ${applicationId}`);
            return null;
          }
          
          const row = rows[0];
          const vote = {
            id: row.id,
            applicationId: row.application_id,
            voterId: row.voter_id,
            voteType: row.vote_type === 'positive' ? VoteType.POSITIVE : VoteType.NEGATIVE,
            createdAt: row.created_at
          };
          
          logger.debug(`Найден голос: пользователь ${voterId}, заявка ${applicationId}, тип ${vote.voteType}`);
          return vote;
        } catch (error) {
          logger.error('Ошибка при получении голоса пользователя:', {
            error: error,
            applicationId: applicationId,
            voterId: voterId,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      });
    }, 60); // Кэшируем на 1 минуту
  }
}