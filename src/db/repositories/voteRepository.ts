import { executeQuery } from '../connection';
import { VoteType } from '../../models/types';

interface Vote {
  id?: number;
  applicationId: number;
  voterId: number;
  voteType: VoteType;
  createdAt?: Date;
}

interface VoteCounts {
  positive: number;
  negative: number;
}

/**
 * Репозиторий для работы с голосами
 */
export class VoteRepository {
  
  /**
   * Добавляет новый голос за заявку
   */
  async addVote(vote: Vote): Promise<number> {
    try {
      const result = await executeQuery(
        `INSERT INTO votes (application_id, voter_id, vote_type, created_at)
         VALUES (?, ?, ?, NOW())
         RETURNING id`,
        [vote.applicationId, vote.voterId, vote.voteType]
      );
      
      return result[0].id;
    } catch (error) {
      console.error('Ошибка при добавлении голоса:', error);
      throw error;
    }
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
   * Удаляет все голоса для заявки
   */
  async deleteVotes(applicationId: number): Promise<void> {
    try {
      await executeQuery(
        `DELETE FROM votes
         WHERE application_id = ?`,
        [applicationId]
      );
    } catch (error) {
      console.error('Ошибка при удалении голосов:', error);
      throw error;
    }
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
} 