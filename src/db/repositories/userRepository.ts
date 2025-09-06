import { executeQuery } from '../connection';
import type { User, WhitelistStatus } from '../../models/types';
import { UserRole } from '../../models/types';
import { logger } from '../../utils/logger';
import { RoleManager } from '../../components/roles';

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
    nickname?: string;
    minecraftNickname: string;
    role?: UserRole;
    canVote?: boolean;
  }): Promise<User> {
    const result = await executeQuery(
      `INSERT INTO users 
       (telegram_id, username, nickname, minecraft_nickname, role, can_vote) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userData.telegramId,
        userData.username || null,
        userData.nickname || userData.username || userData.minecraftNickname,
        userData.minecraftNickname,
        userData.role || RoleManager.ROLES.VISITOR,
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
    
    if (userData.nickname !== undefined) {
      setValues.push('nickname = ?');
      params.push(userData.nickname);
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

    if (userData.totalRatingsGiven !== undefined) {
      setValues.push('total_ratings_given = ?');
      params.push(userData.totalRatingsGiven);
    }

    if (userData.lastRatingGiven !== undefined) {
      setValues.push('last_rating_given = ?');
      params.push(userData.lastRatingGiven);
    }

    if (userData.whitelistStatus !== undefined) {
      setValues.push('whitelist_status = ?');
      params.push(userData.whitelistStatus);
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
    try {
      logger.info('Запрос на получение всех участников сообщества');
      
      // Получаем и участников (MEMBER), и администраторов (ADMIN)
      const users = await executeQuery(
        `SELECT u.id, u.telegram_id, u.username, u.nickname, 
                u.minecraft_nickname, u.minecraft_uuid, u.role, 
                u.can_vote, u.total_ratings_given, u.last_rating_given,
                u.positive_ratings_received, u.negative_ratings_received, 
                u.total_ratings_received, u.created_at, u.updated_at,
                (u.positive_ratings_received - u.negative_ratings_received) as reputation
         FROM users u 
         WHERE u.role IN (?, ?)
         ORDER BY u.nickname ASC`,
        [RoleManager.ROLES.MEMBER, RoleManager.ROLES.ADMIN]
      );
      
      logger.info(`Найдено ${users.length} участников`);
      return users.map(this.mapDbToUser);
    } catch (error) {
      logger.error('Ошибка при получении участников сообщества:', error);
      throw error;
    }
  }
  
  /**
   * Получение всех пользователей
   */
  async findAll(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users ORDER BY created_at ASC`
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
      [RoleManager.ROLES.ADMIN]
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
   * Обновление прав голосования для всех участников (MEMBER)
   */
  async updateAllMembersVotingRights(): Promise<number> {
    try {
      const result = await executeQuery(
        `UPDATE users SET can_vote = true WHERE role = ?`,
        [RoleManager.ROLES.MEMBER]
      );
      
      logger.info(`Обновлены права голосования для всех участников (${result.affectedRows} пользователей)`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Ошибка при обновлении прав голосования участников:', error);
      throw error;
    }
  }
  
  /**
   * Получение всех одобренных пользователей с UUID для синхронизации whitelist
   */
  async findApprovedUsersWithUUID(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE role = ? AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`,
      [RoleManager.ROLES.MEMBER]
    );
    
    return users.map((user: any) => this.mapDbToUser(user));
  }

  /**
   * Получение пользователей со статусом whitelist 'not_added'
   */
  async findUsersNotInWhitelist(): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE role = ? AND minecraft_uuid IS NOT NULL AND minecraft_uuid != '' AND whitelist_status = ?`,
      [RoleManager.ROLES.MEMBER, 'not_added']
    );
    
    return users.map((user: any) => this.mapDbToUser(user));
  }

  /**
   * Обновление статуса whitelist пользователя
   * @param id ID пользователя
   * @param status Новый статус whitelist
   */
  async updateWhitelistStatus(id: number, status: WhitelistStatus): Promise<User> {
    return this.update(id, { whitelistStatus: status });
  }

  /**
   * Поиск пользователей по никнейму (частичное совпадение)
   * @param nickname Никнейм для поиска
   */
  async findByNickname(nickname: string): Promise<User[]> {
    const users = await executeQuery(
      `SELECT * FROM users WHERE nickname LIKE ?`,
      [`%${nickname}%`]
    );
    
    return users.map(this.mapDbToUser);
  }
  
  /**
   * Преобразование данных из БД в объект пользователя
   * @param dbUser Данные пользователя из БД
   */
  private mapDbToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      telegramId: dbUser.telegram_id,
      username: dbUser.username,
      nickname: dbUser.nickname,
      minecraftNickname: dbUser.minecraft_nickname,
      minecraftUUID: dbUser.minecraft_uuid,
      role: dbUser.role as UserRole,
      canVote: Boolean(dbUser.can_vote),
      reputation: dbUser.reputation || 0,
      totalRatingsGiven: dbUser.total_ratings_given || 0,
      lastRatingGiven: dbUser.last_rating_given,
      positiveRatingsReceived: dbUser.positive_ratings_received || 0,
      negativeRatingsReceived: dbUser.negative_ratings_received || 0,
      totalRatingsReceived: dbUser.total_ratings_received || 0,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at)
    };
  }
}