import { executeQuery } from '../connection';

interface Question {
  id?: number;
  applicationId: number;
  askerId: number;
  text: string;
  answer?: string;
  answeredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class QuestionRepository {
  /**
   * Добавляет новый вопрос к заявке
   */
  async addQuestion(question: Question): Promise<number> {
    try {
      const result = await executeQuery(
        `INSERT INTO questions (application_id, asker_id, text, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())
         RETURNING id`,
        [question.applicationId, question.askerId, question.text]
      );
      
      return result[0].id;
    } catch (error) {
      console.error('Ошибка при добавлении вопроса:', error);
      throw error;
    }
  }
  
  /**
   * Находит вопрос по ID
   */
  async findById(id: number): Promise<Question | null> {
    try {
      const result = await executeQuery(
        `SELECT 
           id,
           application_id as applicationId,
           asker_id as askerId,
           text,
           answer,
           answered_at as answeredAt,
           created_at as createdAt,
           updated_at as updatedAt
         FROM questions
         WHERE id = ?`,
        [id]
      );
      
      if (result.length === 0) {
        return null;
      }
      
      return this.mapDbToQuestion(result[0]);
    } catch (error) {
      console.error('Ошибка при поиске вопроса:', error);
      throw error;
    }
  }
  
  /**
   * Находит все вопросы к заявке
   */
  async findByApplicationId(applicationId: number): Promise<Question[]> {
    try {
      const result = await executeQuery(
        `SELECT 
           id,
           application_id as applicationId,
           asker_id as askerId,
           text,
           answer,
           answered_at as answeredAt,
           created_at as createdAt,
           updated_at as updatedAt
         FROM questions
         WHERE application_id = ?
         ORDER BY created_at DESC`,
        [applicationId]
      );
      
      return result.map((row: any) => this.mapDbToQuestion(row));
    } catch (error) {
      console.error('Ошибка при поиске вопросов:', error);
      throw error;
    }
  }
  
  /**
   * Отвечает на вопрос
   */
  async answerQuestion(id: number, answer: string): Promise<boolean> {
    try {
      const result = await executeQuery(
        `UPDATE questions
         SET answer = ?, answered_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [answer, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Ошибка при ответе на вопрос:', error);
      throw error;
    }
  }
  
  /**
   * Удаляет вопрос
   */
  async deleteQuestion(id: number): Promise<boolean> {
    try {
      const result = await executeQuery(
        `DELETE FROM questions
         WHERE id = ?`,
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Ошибка при удалении вопроса:', error);
      throw error;
    }
  }
  
  /**
   * Удаляет все вопросы к заявке
   */
  async deleteByApplicationId(applicationId: number): Promise<void> {
    try {
      await executeQuery(
        `DELETE FROM questions
         WHERE application_id = ?`,
        [applicationId]
      );
    } catch (error) {
      console.error('Ошибка при удалении вопросов:', error);
      throw error;
    }
  }
  
  /**
   * Преобразует результат запроса в объект Question
   */
  private mapDbToQuestion(dbQuestion: any): Question {
    const answeredAt = dbQuestion.answeredAt 
      ? new Date(dbQuestion.answeredAt) 
      : undefined;
    
    const createdAt = dbQuestion.createdAt 
      ? new Date(dbQuestion.createdAt) 
      : undefined;
    
    const updatedAt = dbQuestion.updatedAt 
      ? new Date(dbQuestion.updatedAt) 
      : undefined;
    
    return {
      id: dbQuestion.id,
      applicationId: dbQuestion.applicationId,
      askerId: dbQuestion.askerId,
      text: dbQuestion.text,
      answer: dbQuestion.answer,
      answeredAt,
      createdAt,
      updatedAt
    };
  }
} 