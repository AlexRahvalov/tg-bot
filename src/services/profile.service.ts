import { UserModel, User, UserRole } from '../models/user.model';
import { ApplicationModel, ApplicationStatus, Application } from '../models/application.model';
import { MinecraftService } from './minecraft.service';

/**
 * Интерфейс для расширенного профиля пользователя
 */
export interface UserProfile extends User {
  // Дополнительные поля профиля
  activeApplication?: Application;
  totalApplications: number;
  totalVotes: number;
  positiveVotes: number;
  negativeVotes: number;
  whitelistStatus?: boolean;
  // Метрики активности
  reputation?: number;
  applications?: Application[];
}

/**
 * Класс для работы с профилями пользователей
 */
export class ProfileService {
  /**
   * Получение профиля пользователя по ID в Telegram
   * @param telegramId - ID пользователя в Telegram
   * @returns Профиль пользователя или null, если не найден
   */
  static async getUserProfile(telegramId: number): Promise<UserProfile | null> {
    try {
      // Получаем основные данные пользователя
      const user = await UserModel.getByTelegramId(telegramId);
      if (!user) return null;

      // Получаем активную заявку пользователя
      const activeApplication = await ApplicationModel.getActiveByUser(telegramId);
      
      // Получаем количество заявок пользователя
      const totalApplications = await ApplicationModel.countByUser(telegramId);
      
      // Получаем количество голосов пользователя
      const voteCounts = await UserModel.getUserVotesStats(telegramId);
      
      // Проверяем статус вайтлиста
      const minecraftService = new MinecraftService();
      let whitelistStatus = false;
      
      try {
        if (user.minecraftUsername) {
          // Проверяем состояние сервера, чтобы узнать есть ли пользователь в белом списке
          const serverStatus = await minecraftService.getServerStatus();
          if (serverStatus.online) {
            // Определяем статус вайтлиста на основе доступности игрока
            // Это заглушка, так как прямой метод проверки вайтлиста не доступен
            whitelistStatus = true;
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке вайтлиста:', error);
      }
      
      const userProfile: UserProfile = {
        ...user,
        activeApplication: activeApplication || undefined,
        totalApplications,
        totalVotes: voteCounts.total,
        positiveVotes: voteCounts.positive,
        negativeVotes: voteCounts.negative,
        whitelistStatus
      };
      
      return userProfile;
    } catch (error) {
      console.error('Ошибка при получении профиля пользователя:', error);
      return null;
    }
  }
  
  /**
   * Получение расширенного профиля пользователя (с историей)
   * @param telegramId - ID пользователя в Telegram
   * @returns Расширенный профиль пользователя
   */
  static async getDetailedUserProfile(telegramId: number): Promise<UserProfile | null> {
    try {
      const userProfile = await this.getUserProfile(telegramId);
      if (!userProfile) return null;
      
      // Дополняем профиль историей заявок
      userProfile.applications = await ApplicationModel.getAllByUser(telegramId);
      
      // Рассчитываем репутацию
      userProfile.reputation = this.calculateReputation(userProfile);
      
      return userProfile;
    } catch (error) {
      console.error('Ошибка при получении подробного профиля пользователя:', error);
      return null;
    }
  }
  
  /**
   * Расчет репутации пользователя
   * @param profile - Профиль пользователя
   * @returns Репутация (от 0 до 100)
   */
  static calculateReputation(profile: UserProfile): number {
    // Базовая репутация
    let reputation = 50;
    
    // Если пользователь в вайтлисте, добавляем 20 баллов
    if (profile.whitelistStatus) {
      reputation += 20;
    }
    
    // Если у пользователя есть голоса, учитываем их
    if (profile.totalVotes > 0) {
      const voteRatio = profile.positiveVotes / profile.totalVotes;
      reputation += Math.round(voteRatio * 20); // Максимум 20 баллов за хорошие голоса
    }
    
    // Если пользователь администратор, добавляем 10 баллов
    if (profile.role === UserRole.ADMIN) {
      reputation += 10;
    }
    
    // Ограничиваем репутацию от 0 до 100
    return Math.max(0, Math.min(100, reputation));
  }
  
  /**
   * Получение количества голосов пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Объект с количеством голосов
   */
  static async getUserVoteCounts(telegramId: number): Promise<{total: number, positive: number, negative: number}> {
    try {
      return await UserModel.getUserVotesStats(telegramId);
    } catch (error) {
      console.error('Ошибка при получении голосов пользователя:', error);
      return {
        total: 0,
        positive: 0,
        negative: 0
      };
    }
  }
  
  /**
   * Обновление профиля пользователя
   * @param telegramId - ID пользователя в Telegram
   * @param userData - Данные для обновления
   * @returns Обновленный пользователь или null при ошибке
   */
  static async updateUserProfile(telegramId: number, userData: Partial<User>): Promise<User | null> {
    try {
      // Сначала получаем пользователя, чтобы узнать его ID
      const user = await UserModel.getByTelegramId(telegramId);
      if (!user || !user.id) return null;
      
      // Обновляем пользователя по ID
      return await UserModel.update(user.id, userData);
    } catch (error) {
      console.error('Ошибка при обновлении профиля пользователя:', error);
      return null;
    }
  }
  
  /**
   * Создание профиля пользователя
   * @param userData - Данные пользователя
   * @returns Созданный пользователь или null при ошибке
   */
  static async createUserProfile(userData: Omit<User, 'id' | 'created' | 'updated'>): Promise<User | null> {
    try {
      const newUser = await UserModel.create(userData);
      return newUser;
    } catch (error) {
      console.error('Ошибка при создании профиля пользователя:', error);
      return null;
    }
  }

  /**
   * Получение истории заявок пользователя
   * @param telegramId - Telegram ID пользователя
   * @returns Массив с историей заявок
   */
  static async getUserApplicationHistory(telegramId: number): Promise<Application[]> {
    try {
      return await ApplicationModel.getAllByUser(telegramId);
    } catch (error) {
      console.error('Ошибка при получении истории заявок пользователя:', error);
      return [];
    }
  }

  /**
   * Получение истории голосов пользователя
   * @param telegramId - Telegram ID пользователя
   * @returns Массив с историей голосов
   */
  static async getUserVotingHistory(telegramId: number): Promise<any[]> {
    try {
      return await UserModel.getUserVotesHistory(telegramId);
    } catch (error) {
      console.error('Ошибка при получении истории голосов пользователя:', error);
      return [];
    }
  }

  /**
   * Проверка наличия пользователя в системе
   * @param telegramId - Telegram ID пользователя
   * @returns true, если пользователь существует
   */
  static async userExists(telegramId: number): Promise<boolean> {
    try {
      const user = await UserModel.getByTelegramId(telegramId);
      return user !== null;
    } catch (error) {
      console.error('Ошибка при проверке наличия пользователя:', error);
      return false;
    }
  }
} 