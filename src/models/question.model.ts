import { executeQuery } from '../database/connection';

/**
 * Интерфейс вопроса
 */
export interface Question {
  id?: number;                // ID в базе данных
  applicationId: number;      // ID заявки
  fromUserId: number;         // ID пользователя, который задал вопрос
  question: string;           // Текст вопроса
  answer?: string;            // Текст ответа
  answeredAt?: Date;          // Дата ответа
  created: Date;              // Дата создания
}

/**
 * Класс для работы с вопросами
 */
export class QuestionModel {
  /**
   * Получение вопроса по ID
   * @param id - ID вопроса
   * @returns Вопрос или null, если не найден
   */
  static async getById(id: number): Promise<Question | null> {
    const questions = await executeQuery<Question[]>(
      'SELECT * FROM questions WHERE id = ?',
      [id]
    );
    
    return questions.length > 0 ? questions[0] : null;
  }

  /**
   * Создание нового вопроса
   * @param question - Данные вопроса
   * @returns Созданный вопрос
   */
  static async create(question: Omit<Question, 'id' | 'answer' | 'answeredAt' | 'created'>): Promise<Question> {
    const now = new Date();
    
    const result = await executeQuery<{insertId: number}>(
      'INSERT INTO questions (applicationId, fromUserId, question, created) VALUES (?, ?, ?, ?)',
      [question.applicationId, question.fromUserId, question.question, now]
    );
    
    return {
      id: result.insertId,
      ...question,
      created: now
    };
  }

  /**
   * Добавление ответа на вопрос
   * @param id - ID вопроса
   * @param answer - Текст ответа
   * @returns true, если обновление успешно
   */
  static async addAnswer(id: number, answer: string): Promise<boolean> {
    const now = new Date();
    
    const result = await executeQuery<{affectedRows: number}>(
      'UPDATE questions SET answer = ?, answeredAt = ? WHERE id = ?',
      [answer, now, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Получение всех вопросов по заявке
   * @param applicationId - ID заявки
   * @returns Массив вопросов
   */
  static async getByApplicationId(applicationId: number): Promise<Question[]> {
    return executeQuery<Question[]>(
      'SELECT * FROM questions WHERE applicationId = ? ORDER BY created ASC',
      [applicationId]
    );
  }

  /**
   * Получение неотвеченных вопросов по заявке
   * @param applicationId - ID заявки
   * @returns Массив неотвеченных вопросов
   */
  static async getUnansweredByApplicationId(applicationId: number): Promise<Question[]> {
    return executeQuery<Question[]>(
      'SELECT * FROM questions WHERE applicationId = ? AND answer IS NULL ORDER BY created ASC',
      [applicationId]
    );
  }
} 