import { createHash } from 'crypto';
import { logger } from '../utils/logger';

interface MojangApiResponse {
  id: string;
  name: string;
}

/**
 * Сервис для работы с Minecraft API
 */
export class MinecraftService {
  private readonly mojangApiUrl = 'https://api.mojang.com/users/profiles/minecraft';
  
  /**
   * Проверка существования никнейма и получение UUID
   * @param nickname Никнейм игрока
   */
  async getPlayerUUID(nickname: string): Promise<{ exists: boolean; uuid?: string }> {
    try {
      const response = await fetch(`${this.mojangApiUrl}/${encodeURIComponent(nickname)}`);
      
      // Если игрок не найден
      if (response.status === 404) {
        return { exists: false };
      }
      
      if (!response.ok) {
        throw new Error(`API вернул ошибку: ${response.status}`);
      }
      
      const data = await response.json() as MojangApiResponse;
      return { exists: true, uuid: this.formatUUID(data.id) };
    } catch (error) {
      logger.error('Ошибка при получении UUID игрока:', error);
      // В случае ошибки сети, генерируем оффлайн-UUID
      return { exists: false, uuid: this.generateOfflineUUID(nickname) };
    }
  }
  
  /**
   * Форматирование UUID из формата без дефисов в стандартный формат с дефисами
   * @param uuid UUID без дефисов
   */
  private formatUUID(uuid: string): string {
    return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
  }
  
  /**
   * Генерация оффлайн-UUID для игрока
   * Алгоритм соответствует тому, что используется в Minecraft для оффлайн-серверов
   * @param nickname Никнейм игрока
   */
  generateOfflineUUID(nickname: string): string {
    // Создаем MD5 хеш строки "OfflinePlayer:{nickname}"
    const md5Hash = createHash('md5').update(`OfflinePlayer:${nickname}`).digest('hex');
    
    // Базовый UUID без преобразований (для MD5 хеша)
    const rawUuid = md5Hash;
    
    // Устанавливаем версию UUID (v3 для MD5)
    const p1 = rawUuid.substring(0, 8);
    const p2 = rawUuid.substring(8, 12);
    // Устанавливаем биты версии (v3 = MD5, биты должны быть 0011)
    const p3 = (parseInt(rawUuid.substring(12, 16), 16) & 0x0fff | 0x3000).toString(16);
    // Устанавливаем вариант (биты должны быть 10xx)
    const p4 = (parseInt(rawUuid.substring(16, 20), 16) & 0x3fff | 0x8000).toString(16);
    const p5 = rawUuid.substring(20, 32);
    
    // Форматируем как стандартный UUID с дефисами
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }
  
  /**
   * Добавление игрока в белый список Minecraft-сервера
   * @param nickname Никнейм игрока
   * @param uuid UUID игрока
   */
  async addToWhitelist(nickname: string, uuid: string): Promise<boolean> {
    try {
      // TODO: Здесь будет интеграция с RCON Minecraft-сервера
      logger.info(`Добавление игрока ${nickname} (${uuid}) в белый список`);
      
      // Заглушка для демонстрации
      return true;
    } catch (error) {
      logger.error('Ошибка при добавлении игрока в белый список:', error);
      return false;
    }
  }
  
  /**
   * Удаление игрока из белого списка Minecraft-сервера
   * @param nickname Никнейм игрока
   * @param uuid UUID игрока (опционально)
   */
  async removeFromWhitelist(nickname: string, uuid?: string): Promise<boolean> {
    try {
      // TODO: Здесь будет интеграция с RCON Minecraft-сервера
      if (uuid) {
        logger.info(`Удаление игрока ${nickname} (${uuid}) из белого списка`);
      } else {
        logger.info(`Удаление игрока ${nickname} из белого списка`);
      }
      
      // Заглушка для демонстрации
      return true;
    } catch (error) {
      logger.error('Ошибка при удалении игрока из белого списка:', error);
      return false;
    }
  }
} 