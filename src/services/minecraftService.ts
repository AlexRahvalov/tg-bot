import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { status, RCON } from 'minecraft-server-util';
import config from '../config/env';

interface MojangApiResponse {
  id: string;
  name: string;
}

/**
 * Сервис для работы с Minecraft API и сервером
 */
export class MinecraftService {
  private readonly mojangApiUrl = 'https://api.mojang.com/users/profiles/minecraft';
  private readonly serverHost = config.minecraft.host;
  private readonly rconPort = config.minecraft.rconPort;
  private readonly rconPassword = config.minecraft.rconPassword;
  private readonly statusCheckTimeout = 5000; // Таймаут для проверки статуса сервера (5 секунд)
  private readonly rconTimeout = 5000; // Таймаут для RCON подключения (5 секунд)
  
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
   * Проверка доступности сервера Minecraft
   * @returns Объект с флагом online и дополнительной информацией о сервере (если доступен)
   */
  async checkServerStatus(): Promise<{ online: boolean; info?: any }> {
    try {
      logger.info(`Проверка статуса сервера ${this.serverHost}:${this.rconPort}...`);
      const result = await status(this.serverHost, 25565, {
        timeout: this.statusCheckTimeout
      });
      
      return {
        online: true,
        info: {
          version: result.version.name,
          players: {
            online: result.players.online,
            max: result.players.max
          },
          motd: result.motd.clean
        }
      };
    } catch (error) {
      logger.error('Ошибка при проверке статуса сервера:', error);
      return { online: false };
    }
  }
  
  /**
   * Выполнение команды через RCON
   * @param command Команда для выполнения
   * @returns Результат выполнения команды или null в случае ошибки
   */
  async executeRconCommand(command: string): Promise<string | null> {
    let rcon: RCON | null = null;
    
    try {
      // Проверяем статус сервера перед подключением
      const status = await this.checkServerStatus();
      if (!status.online) {
        throw new Error('Сервер недоступен');
      }
      
      // Создаем подключение RCON
      rcon = new RCON();
      
      // Подключаемся к серверу
      await rcon.connect(this.serverHost, this.rconPort);
      
      // Авторизуемся
      await rcon.login(this.rconPassword);
      
      // Выполняем команду
      logger.info(`Выполнение RCON команды: ${command}`);
      const response = await rcon.execute(command);
      
      return response;
    } catch (error) {
      logger.error(`Ошибка при выполнении RCON команды "${command}":`, error);
      return null;
    } finally {
      // Закрываем соединение, если оно было открыто
      if (rcon) {
        try {
          await rcon.close();
        } catch (closeError) {
          logger.error('Ошибка при закрытии RCON соединения:', closeError);
        }
      }
    }
  }
  
  /**
   * Добавление игрока в белый список Minecraft-сервера
   * @param nickname Никнейм игрока
   * @param uuid UUID игрока
   */
  async addToWhitelist(nickname: string, uuid: string): Promise<boolean> {
    try {
      logger.info(`Добавление игрока ${nickname} (${uuid}) в белый список`);
      
      // Проверяем статус сервера
      const status = await this.checkServerStatus();
      if (!status.online) {
        logger.error('Сервер недоступен, невозможно добавить игрока в белый список');
        return false;
      }
      
      // Формируем команду whitelist add с указанием UUID
      // В современных версиях Minecraft это важно, так как игроки могут менять ники
      const command = `whitelist add ${nickname}`;
      const response = await this.executeRconCommand(command);
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Проверяем успешность выполнения команды
      const success = response.includes('added to the whitelist') || 
                     response.includes('добавлен в белый список');
      
      if (success) {
        logger.info(`Игрок ${nickname} успешно добавлен в белый список`);
      } else {
        logger.warn(`Ошибка при добавлении игрока ${nickname} в белый список: ${response}`);
      }
      
      return success;
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
      if (uuid) {
        logger.info(`Удаление игрока ${nickname} (${uuid}) из белого списка`);
      } else {
        logger.info(`Удаление игрока ${nickname} из белого списка`);
      }
      
      // Проверяем статус сервера
      const status = await this.checkServerStatus();
      if (!status.online) {
        logger.error('Сервер недоступен, невозможно удалить игрока из белого списка');
        return false;
      }
      
      // Формируем команду whitelist remove
      const command = `whitelist remove ${nickname}`;
      const response = await this.executeRconCommand(command);
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Проверяем успешность выполнения команды
      const success = response.includes('removed from the whitelist') || 
                      response.includes('удален из белого списка');
      
      if (success) {
        logger.info(`Игрок ${nickname} успешно удален из белого списка`);
      } else {
        logger.warn(`Ошибка при удалении игрока ${nickname} из белого списка: ${response}`);
      }
      
      return success;
    } catch (error) {
      logger.error('Ошибка при удалении игрока из белого списка:', error);
      return false;
    }
  }
  
  /**
   * Получение списка игроков в белом списке
   * @returns Массив имен игроков в белом списке или null в случае ошибки
   */
  async getWhitelistedPlayers(): Promise<string[] | null> {
    try {
      logger.info('Получение списка игроков в белом списке');
      
      // Проверяем статус сервера
      const status = await this.checkServerStatus();
      if (!status.online) {
        logger.error('Сервер недоступен, невозможно получить список игроков');
        return null;
      }
      
      // Выполняем команду whitelist list
      const response = await this.executeRconCommand('whitelist list');
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Извлекаем имена игроков из ответа
      // Примеры форматов ответа:
      // "There are X whitelisted players: player1, player2, ..."
      // "В белом списке находится X игроков: player1, player2, ..."
      
      const players: string[] = [];
      const match = response.match(/(?:whitelisted players:|находится \d+ игроков:) (.*)/i);
      
      if (match && match[1]) {
        // Разбиваем строку с именами игроков на массив и очищаем от пробелов
        players.push(...match[1].split(',').map(name => name.trim()));
      }
      
      return players;
    } catch (error) {
      logger.error('Ошибка при получении списка игроков в белом списке:', error);
      return null;
    }
  }
} 