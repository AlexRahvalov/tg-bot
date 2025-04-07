import { executeQuery } from '../connection';
import type { Application } from '../../models/types';
import { ApplicationStatus } from '../../models/types';

/**
 * Репозиторий для работы с заявками
 */
export class ApplicationRepository {
  
  /**
   * Создание новой заявки
   * @param applicationData Данные заявки
   */
  async create(applicationData: {
    userId: number;
    minecraftNickname: string;
    reason: string;
  }): Promise<Application> {
    const result = await executeQuery(
      `INSERT INTO applications 
       (user_id, minecraft_nickname, reason, status) 
       VALUES (?, ?, ?, ?)`,
      [
        applicationData.userId,
        applicationData.minecraftNickname,
        applicationData.reason,
        ApplicationStatus.PENDING
      ]
    );
    
    const applicationId = result.insertId;
    return this.findById(applicationId);
  }
  
  /**
   * Установка статуса заявки на "На голосовании" и задание времени окончания голосования
   * @param id ID заявки
   * @param votingEndsAt Дата и время окончания голосования
   */
  async startVoting(id: number, votingEndsAt: Date): Promise<Application> {
    await executeQuery(
      `UPDATE applications 
       SET status = ?, voting_ends_at = ? 
       WHERE id = ?`,
      [ApplicationStatus.VOTING, votingEndsAt, id]
    );
    
    return this.findById(id);
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
    await executeQuery(
      `UPDATE applications SET status = ? WHERE id = ?`,
      [status, id]
    );
    
    return this.findById(id);
  }
  
  /**
   * Получение заявки по ID
   * @param id ID заявки
   */
  async findById(id: number): Promise<Application> {
    const applications = await executeQuery(
      `SELECT * FROM applications WHERE id = ?`,
      [id]
    );
    
    if (applications.length === 0) {
      throw new Error(`Заявка с ID ${id} не найдена`);
    }
    
    return this.mapDbToApplication(applications[0]);
  }
  
  /**
   * Получение заявок в статусе "На голосовании" и "На рассмотрении"
   */
  async findVotingApplications(): Promise<Application[]> {
    const applications = await executeQuery(
      `SELECT * FROM applications WHERE status = ? OR status = ? ORDER BY created_at DESC`,
      [ApplicationStatus.VOTING, ApplicationStatus.PENDING]
    );
    
    return applications.map(this.mapDbToApplication);
  }
  
  /**
   * Получение активных заявок пользователя (в статусе "На рассмотрении" или "На голосовании")
   * @param userId ID пользователя
   */
  async findActiveApplicationsByUserId(userId: number): Promise<Application[]> {
    const applications = await executeQuery(
      `SELECT * FROM applications 
       WHERE user_id = ? AND (status = ? OR status = ?)`,
      [userId, ApplicationStatus.PENDING, ApplicationStatus.VOTING]
    );
    
    return applications.map(this.mapDbToApplication);
  }
  
  /**
   * Получение всех активных заявок (в статусе "На рассмотрении" или "На голосовании")
   */
  async findActiveApplications(): Promise<Application[]> {
    const applications = await executeQuery(
      `SELECT * FROM applications 
       WHERE status = ? OR status = ?
       ORDER BY created_at DESC`,
      [ApplicationStatus.PENDING, ApplicationStatus.VOTING]
    );
    
    return applications.map(this.mapDbToApplication);
  }
  
  /**
   * Получение завершенных заявок в статусе голосования, время голосования которых истекло
   */
  async findExpiredVotingApplications(): Promise<Application[]> {
    const applications = await executeQuery(
      `SELECT * FROM applications 
       WHERE status = ? AND voting_ends_at < NOW()`,
      [ApplicationStatus.VOTING]
    );
    
    return applications.map(this.mapDbToApplication);
  }
  
  /**
   * Получение последней заявки пользователя
   * @param userId ID пользователя
   */
  async findLastApplicationByUserId(userId: number): Promise<Application | null> {
    const applications = await executeQuery(
      `SELECT * FROM applications 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    
    if (applications.length === 0) {
      return null;
    }
    
    return this.mapDbToApplication(applications[0]);
  }
  
  /**
   * Получение всех заявок пользователя
   * @param userId ID пользователя
   */
  async findAllApplicationsByUserId(userId: number): Promise<Application[]> {
    const applications = await executeQuery(
      `SELECT * FROM applications 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return applications.map(this.mapDbToApplication);
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