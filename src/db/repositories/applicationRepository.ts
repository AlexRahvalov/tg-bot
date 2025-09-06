import { executeQuery, getConnection } from '../connection';
import type { Application } from '../../models/types';
import { ApplicationStatus } from '../../models/types';
import { logger } from '../../utils/logger';
import type { PoolConnection } from 'mariadb';
import { applicationCache, CacheUtils } from '../../utils/cache';

// Классы ошибок для работы с заявками
export class ApplicationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ApplicationNotFoundError extends ApplicationError {
  constructor() {
    super('Заявка не найдена', 'APPLICATION_NOT_FOUND');
  }
}

export class DuplicateApplicationError extends ApplicationError {
  constructor() {
    super('У пользователя уже есть активная заявка', 'DUPLICATE_APPLICATION');
  }
}

// Функция retry для операций с БД
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!shouldRetry(error) || attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.warn(`Попытка ${attempt} неудачна, повтор через ${delay}мс:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

function shouldRetry(error: any): boolean {
  if (error instanceof ApplicationNotFoundError || 
      error instanceof DuplicateApplicationError) {
    return false;
  }
  
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('connection') || 
         errorMessage.includes('timeout') || 
         errorMessage.includes('deadlock');
}

/**
 * Репозиторий для работы с заявками
 */
export class ApplicationRepository {
  [x: string]: any;
  
  /**
   * Создание новой заявки с транзакционной безопасностью
   * @param applicationData Данные заявки
   */
  async create(applicationData: {
    userId: number;
    minecraftNickname: string;
    reason: string;
  }): Promise<Application> {
    return retryOperation(async () => {
      let conn: PoolConnection | null = null;
      try {
        conn = await getConnection();
        await conn.beginTransaction();
        
        // Проверяем, нет ли у пользователя активной заявки
        const existingApplication = await conn.query(
          `SELECT id FROM applications 
           WHERE user_id = ? AND status IN (?, ?) 
           FOR UPDATE`,
          [applicationData.userId, ApplicationStatus.PENDING, ApplicationStatus.VOTING]
        );
        
        if (existingApplication.length > 0) {
          throw new DuplicateApplicationError();
        }
        
        // Создаем новую заявку
        const result = await conn.query(
          `INSERT INTO applications 
           (user_id, minecraft_nickname, reason, status, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            applicationData.userId,
            applicationData.minecraftNickname,
            applicationData.reason,
            ApplicationStatus.PENDING
          ]
        );
        
        await conn.commit();
        
        const applicationId = result.insertId;
         
         // Инвалидируем кэш активных заявок пользователя
         CacheUtils.invalidateApplicationCaches(applicationId, applicationData.userId);
         
         logger.info(`Создана новая заявка: ID ${applicationId}, пользователь ${applicationData.userId}, ник ${applicationData.minecraftNickname}`);
         
         return this.findById(applicationId);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (rollbackError) {
            logger.error('Ошибка при откате транзакции:', rollbackError);
          }
        }
        
        logger.error('Ошибка при создании заявки:', {
          error: error,
          applicationData: applicationData,
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
   * Установка статуса заявки на "На голосовании" и задание времени окончания голосования
   * @param id ID заявки
   * @param votingEndsAt Дата и время окончания голосования
   */
  async startVoting(id: number, votingEndsAt: Date): Promise<Application> {
    return retryOperation(async () => {
      let conn: PoolConnection | null = null;
      try {
        conn = await getConnection();
        await conn.beginTransaction();
        
        // Проверяем существование заявки и её текущий статус
        const application = await conn.query(
          `SELECT id, status FROM applications WHERE id = ? FOR UPDATE`,
          [id]
        );
        
        if (application.length === 0) {
          throw new ApplicationNotFoundError();
        }
        
        if (application[0].status !== ApplicationStatus.PENDING) {
          throw new ApplicationError(`Нельзя начать голосование для заявки со статусом ${application[0].status}`, 'INVALID_STATUS');
        }
        
        // Обновляем статус и время окончания голосования
        const result = await conn.query(
          `UPDATE applications 
           SET status = ?, voting_ends_at = ? 
           WHERE id = ?`,
          [ApplicationStatus.VOTING, votingEndsAt, id]
        );
        
        if (result.affectedRows === 0) {
          throw new ApplicationError('Не удалось обновить статус заявки', 'UPDATE_FAILED');
        }
        
        await conn.commit();
        
        // Инвалидируем кэш заявки
         applicationCache.delete(CacheUtils.applicationKey(id));
         
         logger.info(`Начато голосование для заявки ${id}, окончание: ${votingEndsAt.toISOString()}`);
         
         return this.findById(id);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (rollbackError) {
            logger.error('Ошибка при откате транзакции:', rollbackError);
          }
        }
        
        logger.error('Ошибка при начале голосования:', {
          error: error,
          applicationId: id,
          votingEndsAt: votingEndsAt,
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
   * Обновление счетчиков голосов заявки
   * @param id ID заявки
   * @param positiveVotes Количество положительных голосов
   * @param negativeVotes Количество отрицательных голосов
   */
  async updateVoteCounts(id: number, positiveVotes: number, negativeVotes: number): Promise<Application> {
    await executeQuery(
      `UPDATE applications 
       SET positive_votes = ?, negative_votes = ? 
       WHERE id = ?`,
      [positiveVotes, negativeVotes, id]
    );
    
    return this.findById(id);
  }
  
  /**
   * Изменение статуса заявки
   * @param id ID заявки
   * @param status Новый статус
   */
  async updateStatus(id: number, status: ApplicationStatus): Promise<Application> {
    return retryOperation(async () => {
      let conn: PoolConnection | null = null;
      try {
        conn = await getConnection();
        await conn.beginTransaction();
        
        // Проверяем существование заявки
        const existingApplication = await conn.query(
          `SELECT id, status FROM applications WHERE id = ? FOR UPDATE`,
          [id]
        );
        
        if (existingApplication.length === 0) {
          throw new ApplicationNotFoundError();
        }
        
        const currentStatus = existingApplication[0].status;
        
        // Обновляем статус
        const result = await conn.query(
          `UPDATE applications SET status = ? WHERE id = ?`,
          [status, id]
        );
        
        if (result.affectedRows === 0) {
          throw new ApplicationError('Не удалось обновить статус заявки', 'UPDATE_FAILED');
        }
        
        await conn.commit();
        
        // Инвалидируем кэш заявки
         applicationCache.delete(CacheUtils.applicationKey(id));
         
         logger.info(`Статус заявки ${id} изменен с ${currentStatus} на ${status}`);
         
         return this.findById(id);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (rollbackError) {
            logger.error('Ошибка при откате транзакции:', rollbackError);
          }
        }
        
        logger.error('Ошибка при обновлении статуса заявки:', {
          error: error,
          applicationId: id,
          newStatus: status,
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
   * Получение заявки по ID (с кэшированием)
   * @param id ID заявки
   */
  async findById(id: number): Promise<Application> {
    const cacheKey = CacheUtils.applicationKey(id);
    
    return applicationCache.getOrSet(cacheKey, async () => {
      return retryOperation(async () => {
        try {
          const applications = await executeQuery(
            `SELECT * FROM applications WHERE id = ?`,
            [id]
          );
          
          if (applications.length === 0) {
            throw new ApplicationNotFoundError();
          }
          
          const application = this.mapDbToApplication(applications[0]);
          logger.debug(`Найдена заявка: ID ${id}, статус ${application.status}`);
          
          return application;
        } catch (error) {
          if (error instanceof ApplicationNotFoundError) {
            throw error;
          }
          
          logger.error('Ошибка при поиске заявки по ID:', {
            error: error,
            applicationId: id,
            timestamp: new Date().toISOString()
          });
          
          throw error;
        }
      });
    }, 300); // Кэшируем на 5 минут
  }
  
  /**
   * Получение заявок в статусе "На голосовании" и "На рассмотрении" (с кэшированием)
   */
  async findVotingApplications(): Promise<Application[]> {
    const cacheKey = 'voting_applications';
    
    return applicationCache.getOrSet(cacheKey, async () => {
      return retryOperation(async () => {
        try {
          const applications = await executeQuery(
            `SELECT * FROM applications WHERE status = ? OR status = ? ORDER BY created_at DESC`,
            [ApplicationStatus.VOTING, ApplicationStatus.PENDING]
          );
          
          logger.debug(`Найдено ${applications.length} заявок на голосовании/рассмотрении`);
          return applications.map(this.mapDbToApplication);
        } catch (error) {
          logger.error('Ошибка при получении заявок на голосовании:', {
            error: error,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      });
    }, 60); // Кэшируем на 1 минуту
  }
  
  /**
   * Получение активных заявок пользователя (в статусе "На рассмотрении" или "На голосовании")
   * @param userId ID пользователя
   */
  async findActiveApplicationsByUserId(userId: number): Promise<Application[]> {
    const cacheKey = CacheUtils.userActiveApplicationsKey(userId);
    
    return applicationCache.getOrSet(cacheKey, async () => {
      return retryOperation(async () => {
        try {
          const applications = await executeQuery(
            `SELECT * FROM applications 
             WHERE user_id = ? AND (status = ? OR status = ?)`,
            [userId, ApplicationStatus.PENDING, ApplicationStatus.VOTING]
          );
          
          logger.debug(`Найдено ${applications.length} активных заявок для пользователя ${userId}`);
          return applications.map(this.mapDbToApplication);
        } catch (error) {
          logger.error('Ошибка при получении активных заявок пользователя:', {
            error: error,
            userId: userId,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      });
    }, 120); // Кэшируем на 2 минуты
  }
  
  /**
   * Получение всех активных заявок (в статусе "На рассмотрении" или "На голосовании")
   */
  async findActiveApplications(): Promise<Application[]> {
    const cacheKey = 'active_applications';
    
    return applicationCache.getOrSet(cacheKey, async () => {
      return retryOperation(async () => {
        try {
          const applications = await executeQuery(
            `SELECT * FROM applications 
             WHERE status = ? OR status = ?
             ORDER BY created_at DESC`,
            [ApplicationStatus.PENDING, ApplicationStatus.VOTING]
          );
          
          logger.debug(`Найдено ${applications.length} активных заявок`);
          return applications.map(this.mapDbToApplication);
        } catch (error) {
          logger.error('Ошибка при получении активных заявок:', {
            error: error,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      });
    }, 60); // Кэшируем на 1 минуту
  }
  
  /**
   * Получение завершенных заявок в статусе голосования, время голосования которых истекло
   */
  async findExpiredVotingApplications(): Promise<Application[]> {
    return retryOperation(async () => {
      try {
        const applications = await executeQuery(
          `SELECT * FROM applications 
           WHERE status = ? AND voting_ends_at < NOW()`,
          [ApplicationStatus.VOTING]
        );
        
        logger.debug(`Найдено ${applications.length} просроченных заявок на голосовании`);
        return applications.map(this.mapDbToApplication);
      } catch (error) {
        logger.error('Ошибка при получении просроченных заявок:', {
          error: error,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  }
  
  /**
   * Получение последней заявки пользователя
   * @param userId ID пользователя
   */
  async findLastApplicationByUserId(userId: number): Promise<Application | null> {
    return retryOperation(async () => {
      try {
        const applications = await executeQuery(
          `SELECT * FROM applications 
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        );
        
        if (applications.length === 0) {
          logger.debug(`Заявки для пользователя ${userId} не найдены`);
          return null;
        }
        
        const application = this.mapDbToApplication(applications[0]);
        logger.debug(`Найдена последняя заявка для пользователя ${userId}: ID ${application.id}`);
        return application;
      } catch (error) {
        logger.error('Ошибка при получении последней заявки пользователя:', {
          error: error,
          userId: userId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  }
  
  /**
   * Получение всех заявок пользователя
   * @param userId ID пользователя
   */
  async findAllApplicationsByUserId(userId: number): Promise<Application[]> {
    return retryOperation(async () => {
      try {
        const applications = await executeQuery(
          `SELECT * FROM applications 
           WHERE user_id = ?
           ORDER BY created_at DESC`,
          [userId]
        );
        
        logger.debug(`Найдено ${applications.length} заявок для пользователя ${userId}`);
        return applications.map(this.mapDbToApplication);
      } catch (error) {
        logger.error('Ошибка при получении всех заявок пользователя:', {
          error: error,
          userId: userId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  }
  
  /**
   * Преобразование записи из БД в объект Application
   * @param dbApplication Запись из БД
   */
  private mapDbToApplication(dbApplication: any): Application {
    return {
      id: dbApplication.id,
      userId: dbApplication.user_id,
      minecraftNickname: dbApplication.minecraft_nickname,
      reason: dbApplication.reason,
      status: dbApplication.status as ApplicationStatus,
      votingEndsAt: dbApplication.voting_ends_at ? new Date(dbApplication.voting_ends_at) : undefined,
      positiveVotes: dbApplication.positive_votes,
      negativeVotes: dbApplication.negative_votes,
      createdAt: new Date(dbApplication.created_at),
      updatedAt: new Date(dbApplication.updated_at),
    };
  }
}