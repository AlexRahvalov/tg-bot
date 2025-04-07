import { executeQuery } from '../connection';
import type { User } from '../../models/types';
import { UserRole } from '../../models/types';

/**
 * Репозиторий для работы с пользователями
 */
export class UserRepository {
  
  /**
   * Получение пользователя по Telegram ID
   * @param telegramId ID пользователя в Telegram
   */
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE telegram_id = ?`,
      [telegramId]
    );
    
    if (users.length === 0) {
      return null;
    }
    
    return this.mapDbToUser(users[0]);
  }
  
  /**
   * Получение пользователя по Minecraft никнейму
   * @param minecraftNickname Никнейм пользователя в Minecraft
   */
  async findByMinecraftNickname(minecraftNickname: string): Promise<User | null> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE minecraft_nickname = ?`,
      [minecraftNickname]
    );
    
    if (users.length === 0) {
      return null;
    }
    
    return this.mapDbToUser(users[0]);
  }
  
  /**
   * Создание нового пользователя
   * @param userData Данные пользователя
   */
  async create(userData: {
    telegramId: number;
    username?: string;
    minecraftNickname: string;
    role?: UserRole;
    canVote?: boolean;
  }): Promise<User> {
    const result = await executeQuery(
      `INSERT INTO users 
       (telegram_id, username, minecraft_nickname, role, can_vote) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userData.telegramId,
        userData.username || null,
        userData.minecraftNickname,
        userData.role || UserRole.APPLICANT,
        userData.canVote || false
      ]
    );
    
    const userId = result.insertId;
    return this.findById(userId);
  }
  
  /**
   * Обновление данных пользователя
   * @param id ID пользователя
   * @param userData Обновляемые данные
   */
  async update(id: number, userData: Partial<User>): Promise<User> {
    const setValues = [];
    const params = [];
    
    // Динамически формируем запрос на обновление только переданных полей
    if (userData.username !== undefined) {
      setValues.push('username = ?');
      params.push(userData.username);
    }
    
    if (userData.minecraftNickname !== undefined) {
      setValues.push('minecraft_nickname = ?');
      params.push(userData.minecraftNickname);
    }
    
    if (userData.minecraftUUID !== undefined) {
      setValues.push('minecraft_uuid = ?');
      params.push(userData.minecraftUUID);
    }
    
    if (userData.role !== undefined) {
      setValues.push('role = ?');
      params.push(userData.role);
    }
    
    if (userData.canVote !== undefined) {
      setValues.push('can_vote = ?');
      params.push(userData.canVote);
    }
    
    if (userData.reputation !== undefined) {
      setValues.push('reputation = ?');
      params.push(userData.reputation);
    }
    
    if (setValues.length === 0) {
      // Нечего обновлять, возвращаем текущего пользователя
      return this.findById(id);
    }
    
    params.push(id);
    
    await executeQuery(
      `UPDATE users SET ${setValues.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Обновление роли пользователя
   * @param id ID пользователя
   * @param role Новая роль
   */
  async updateRole(id: number, role: UserRole): Promise<User> {
    return this.update(id, { role });
  }
  
  /**
   * Обновление права голосования пользователя
   * @param id ID пользователя
   * @param canVote Новое значение права голосования
   */
  async updateCanVote(id: number, canVote: boolean): Promise<User> {
    return this.update(id, { canVote });
  }
  
  /**
   * Получение всех участников сообщества
   */
  async findAllMembers(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE role = ?`,
      [UserRole.MEMBER]
    );
    
    return users.map(this.mapDbToUser);
  }
  
  /**
   * Получение всех пользователей с правом голоса
   */
  async findVoters(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE can_vote = TRUE`
    );
    
    return users.map(this.mapDbToUser);
  }
  
  /**
   * Получение всех администраторов
   */
  async findAdmins(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE role = ?`,
      [UserRole.ADMIN]
    );
    
    return users.map(this.mapDbToUser);
  }
  
  /**
   * Получение пользователя по ID
   * @param id ID пользователя
   */
  async findById(id: number): Promise<User> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );
    
    if (users.length === 0) {
      throw new Error(`Пользователь с ID ${id} не найден`);
    }
    
    return this.mapDbToUser(users[0]);
  }
  
  /**
   * Преобразование записи из БД в объект User
   * @param dbUser Запись из БД
   */
  private mapDbToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      telegramId: dbUser.telegram_id,
      username: dbUser.username,
      minecraftNickname: dbUser.minecraft_nickname,
      minecraftUUID: dbUser.minecraft_uuid,
      role: dbUser.role as UserRole,
      canVote: Boolean(dbUser.can_vote),
      reputation: dbUser.reputation,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
    };
  }
} 