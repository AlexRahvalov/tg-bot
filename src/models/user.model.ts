import { executeQuery } from '../database/connection';

/**
 * Типы ролей пользователей
 */
export enum UserRole {
  NEW = 'new',            // Новый пользователь (только зарегистрировался)
  GUEST = 'guest',        // Гость (подал заявку, ожидает решения)
  MEMBER = 'member',      // Участник сообщества (одобренная заявка)
  ADMIN = 'admin'         // Администратор
}

/**
 * Интерфейс пользователя
 */
export interface User {
  id?: number;             // ID в базе данных
  telegramId: number;      // ID пользователя в Telegram
  username?: string;       // Username в Telegram
  firstName: string;       // Имя пользователя
  lastName?: string;       // Фамилия пользователя
  minecraftUsername?: string; // Имя в Minecraft
  minecraftUUID?: string;  // UUID в Minecraft
  role: UserRole;          // Роль пользователя
  canVote: boolean;        // Может ли голосовать
  reputation_positive?: number; // Положительная репутация
  reputation_negative?: number; // Отрицательная репутация
  reputation_last_reset?: Date; // Дата последнего сброса репутации
  created: Date;           // Дата создания
  updated?: Date;          // Дата обновления
}

/**
 * Класс для работы с пользователями
 */
export class UserModel {
  /**
   * Получение пользователя по ID в базе данных
   * @param id - ID пользователя
   * @returns Пользователь или null, если не найден
   */
  static async getById(id: number): Promise<User | null> {
    const users = await executeQuery<User[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Получение пользователя по Telegram ID
   * @param telegramId - ID пользователя в Telegram
   * @returns Пользователь или null, если не найден
   */
  static async getByTelegramId(telegramId: number): Promise<User | null> {
    const users = await executeQuery<User[]>(
      'SELECT * FROM users WHERE telegramId = ?',
      [telegramId]
    );
    
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Создание нового пользователя
   * @param user - Данные пользователя
   * @returns Созданный пользователь
   */
  static async create(user: Omit<User, 'id' | 'created' | 'updated'>): Promise<User> {
    const now = new Date();
    const result = await executeQuery<{insertId: number}>(
      `INSERT INTO users 
      (telegramId, username, firstName, lastName, role, canVote, created) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.telegramId, 
        user.username || null, 
        user.firstName, 
        user.lastName || null, 
        user.role, 
        user.canVote, 
        now
      ]
    );
    
    return {
      id: result.insertId,
      ...user,
      created: now
    };
  }

  /**
   * Обновление данных пользователя по ID
   * @param id - ID пользователя
   * @param userData - Новые данные пользователя
   * @returns Обновленный пользователь или null в случае ошибки
   */
  static async update(id: number, userData: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    // Формирование запроса динамически на основе предоставленных полей
    Object.entries(userData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return null;

    // Добавление поля updated
    fields.push('updated = ?');
    values.push(new Date());

    // Добавление id в конец массива для WHERE
    values.push(id);

    const result = await executeQuery<{affectedRows: number}>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows > 0) {
      // Получение обновленных данных пользователя
      const users = await executeQuery<User[]>(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      return users.length > 0 ? users[0] : null;
    }

    return null;
  }

  /**
   * Получение всех пользователей с правом голоса
   * @returns Массив пользователей с правом голоса
   */
  static async getVoters(): Promise<User[]> {
    return executeQuery<User[]>(
      'SELECT * FROM users WHERE canVote = TRUE',
      []
    );
  }

  /**
   * Получение всех администраторов
   * @returns Массив пользователей с ролью администратора
   */
  static async getAdmins(): Promise<User[]> {
    return executeQuery<User[]>(
      'SELECT * FROM users WHERE role = ?',
      [UserRole.ADMIN]
    );
  }

  /**
   * Получение всех пользователей
   * @returns Массив всех пользователей
   */
  static async getAllUsers(): Promise<User[]> {
    return executeQuery<User[]>(
      'SELECT * FROM users ORDER BY created DESC',
      []
    );
  }

  /**
   * Получение количества всех пользователей
   * @returns Количество пользователей
   */
  static async getUserCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users',
      []
    );
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Получение количества администраторов
   * @returns Количество администраторов
   */
  static async getAdminCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [UserRole.ADMIN]
    );
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Получение количества участников
   * @returns Количество участников
   */
  static async getMemberCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [UserRole.MEMBER]
    );
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Получение количества новых пользователей
   * @returns Количество новых пользователей
   */
  static async getNewUserCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [UserRole.NEW]
    );
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Получение количества гостей
   * @returns Количество гостей
   */
  static async getGuestCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [UserRole.GUEST]
    );
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Обновление роли пользователя
   * @param userId - ID пользователя
   * @param newRole - Новая роль
   * @returns true, если обновление успешно
   */
  static async updateRole(userId: number, newRole: UserRole): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'UPDATE users SET role = ?, updated = ? WHERE id = ?',
      [newRole, new Date(), userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Обновление права голоса пользователя
   * @param userId - ID пользователя
   * @param canVote - Может ли пользователь голосовать
   * @returns true, если обновление успешно
   */
  static async updateVotePermission(userId: number, canVote: boolean): Promise<boolean> {
    const result = await executeQuery<{affectedRows: number}>(
      'UPDATE users SET canVote = ?, updated = ? WHERE id = ?',
      [canVote, new Date(), userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Получение количества пользователей с правом голоса
   * @returns Количество пользователей с правом голоса
   */
  static async getVotersCount(): Promise<number> {
    const result = await executeQuery<{count: number}[]>(
      'SELECT COUNT(*) as count FROM users WHERE canVote = TRUE',
      []
    );
    // Преобразуем BigInt в Number, если нужно
    return typeof result[0]?.count === 'bigint' ? Number(result[0]?.count) : (result[0]?.count ?? 0);
  }

  /**
   * Получение статистики голосов пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Объект со статистикой голосов
   */
  static async getUserVotesStats(telegramId: number): Promise<{total: number, positive: number, negative: number}> {
    try {
      // Получение ID пользователя
      const user = await this.getByTelegramId(telegramId);
      if (!user || !user.id) {
        return { total: 0, positive: 0, negative: 0 };
      }

      // Получение количества голосов
      const result = await executeQuery<{total: number, positive: number, negative: number}[]>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN voteType = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN voteType = 'negative' THEN 1 ELSE 0 END) as negative
        FROM votes 
        WHERE userId = ?`,
        [user.id]
      );

      if (result.length === 0) {
        return { total: 0, positive: 0, negative: 0 };
      }

      return {
        total: result[0].total || 0,
        positive: result[0].positive || 0,
        negative: result[0].negative || 0
      };
    } catch (error) {
      console.error('Ошибка при получении статистики голосов пользователя:', error);
      return { total: 0, positive: 0, negative: 0 };
    }
  }

  /**
   * Получение истории голосов пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Массив с историей голосов
   */
  static async getUserVotesHistory(telegramId: number): Promise<any[]> {
    try {
      // Получение ID пользователя
      const user = await this.getByTelegramId(telegramId);
      if (!user || !user.id) {
        return [];
      }

      // Получение истории голосов
      return await executeQuery(
        `SELECT 
          v.id, 
          v.applicationId, 
          v.voteType, 
          v.created,
          a.minecraftUsername,
          a.status
        FROM votes v
        JOIN applications a ON v.applicationId = a.id
        WHERE v.userId = ?
        ORDER BY v.created DESC`,
        [user.id]
      );
    } catch (error) {
      console.error('Ошибка при получении истории голосов пользователя:', error);
      return [];
    }
  }
} 