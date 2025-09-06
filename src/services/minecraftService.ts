import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { Rcon } from 'rcon-client';
import config from '../config/env';
import { UserRepository } from '../db/repositories/userRepository.js';
import { WhitelistStatus } from '../models/types.js';

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
    let rcon: Rcon | null = null;
    
    try {
      logger.info(`Проверка статуса сервера ${this.serverHost}:${this.rconPort}...`);
      
      // Создаем RCON подключение для проверки доступности
      rcon = new Rcon({
        host: this.serverHost,
        port: this.rconPort,
        password: this.rconPassword,
        timeout: this.statusCheckTimeout
      });
      
      // Подключаемся к серверу
      await rcon.connect();
      
      // Получаем информацию о сервере через команды
      const listResponse = await rcon.send('list');
      const versionResponse = await rcon.send('version');
      
      // Парсим информацию об игроках из команды list
      let playersOnline = 0;
      let maxPlayers = 0;
      
      // Формат ответа: "There are X of a max of Y players online:"
      const playerMatch = listResponse.match(/There are (\d+) of a max of (\d+) players online/);
      if (playerMatch) {
        playersOnline = parseInt(playerMatch[1] || '0');
        maxPlayers = parseInt(playerMatch[2] || '0');
      }
      
      // Парсим версию сервера
      let version = 'Unknown';
      const versionMatch = versionResponse.match(/This server is running (.+?) version/);
      if (versionMatch) {
        version = versionMatch[1] || 'Unknown';
      }
      
      return {
        online: true,
        info: {
          version: version,
          players: {
            online: playersOnline,
            max: maxPlayers
          },
          motd: 'Server Online' // MOTD недоступен через RCON
        }
      };
    } catch (error) {
      logger.error('Ошибка при проверке статуса сервера:', error);
      return { online: false };
    } finally {
      // Закрываем соединение
      if (rcon) {
        try {
          await rcon.end();
        } catch (closeError) {
          logger.error('Ошибка при закрытии RCON соединения:', closeError);
        }
      }
    }
  }
  
  /**
   * Получение полной информации о сервере для отображения
   * @returns Объект с информацией о сервере (IP, версия, режим игры, статус)
   */
  async getServerInfo(): Promise<{
    ip: string;
    version: string;
    gamemode: string;
    accessType: string;
    online: boolean;
    players?: { online: number; max: number };
  }> {
    const serverStatus = await this.checkServerStatus();
    
    return {
      ip: config.server.displayIp,
      version: serverStatus.online && serverStatus.info?.version ? serverStatus.info.version : config.server.version,
      gamemode: config.server.gamemode,
      accessType: config.server.accessType,
      online: serverStatus.online,
      players: serverStatus.info?.players
    };
  }

  /**
   * Выполнение команды через RCON с механизмом повторных попыток
   * @param command Команда для выполнения
   * @param maxRetries Максимальное количество попыток (по умолчанию 3)
   * @param retryDelay Задержка между попытками в мс (по умолчанию 2000)
   * @returns Результат выполнения команды или null в случае ошибки
   */
  async executeRconCommand(command: string, maxRetries: number = 3, retryDelay: number = 2000): Promise<string | null> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let rcon: Rcon | null = null;
      
      try {
        // Создаем подключение RCON
        rcon = new Rcon({
          host: this.serverHost,
          port: this.rconPort,
          password: this.rconPassword,
          timeout: this.rconTimeout
        });
        
        // Подключаемся к серверу
        await rcon.connect();
        
        // Выполняем команду
        logger.info(`✅ Выполнение RCON команды: ${command} (попытка ${attempt}/${maxRetries})`);
        const response = await rcon.send(command);
        
        logger.info(`✅ RCON команда выполнена успешно: ${command}`);
        return response;
      } catch (error) {
        lastError = error;
        logger.error(`❌ Ошибка при выполнении RCON команды "${command}" (попытка ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          logger.info(`🔄 Повторная попытка через ${retryDelay}мс...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } finally {
        // Закрываем соединение, если оно было открыто
        if (rcon) {
          try {
            await rcon.end();
          } catch (closeError) {
            logger.error('Ошибка при закрытии RCON соединения:', closeError);
          }
        }
      }
    }
    
    logger.error(`❌ Все попытки выполнения RCON команды "${command}" исчерпаны. Последняя ошибка:`, lastError);
    return null;
  }
  
  /**
   * Добавление игрока в белый список Minecraft-сервера
   * @param nickname Никнейм игрока
   * @param uuid UUID игрока
   * @param userId ID пользователя для обновления статуса
   */
  async addToWhitelist(nickname: string, uuid: string, userId?: number): Promise<boolean> {
    try {
      logger.info(`Добавление игрока ${nickname} (${uuid}) в белый список`);
      
      // Формируем команду whitelist add с указанием UUID
      // В современных версиях Minecraft это важно, так как игроки могут менять ники
      const command = `whitelist add ${nickname}`;
      const response = await this.executeRconCommand(command);
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Проверяем успешность выполнения команды
      const success = response.includes('added to the whitelist') || 
                     response.includes('добавлен в белый список') ||
                     response.includes('Added') ||
                     response.includes('Player added to whitelist');
      
      if (success) {
        logger.info(`Игрок ${nickname} успешно добавлен в белый список`);
        // Обновляем статус пользователя на added если передан userId
        if (userId) {
          const userRepo = new UserRepository();
          await userRepo.updateWhitelistStatus(userId, WhitelistStatus.ADDED);
        }
      } else {
        logger.warn(`Ошибка при добавлении игрока ${nickname} в белый список: ${response}`);
        // Обновляем статус пользователя на not_added если передан userId
        if (userId) {
          const userRepo = new UserRepository();
          await userRepo.updateWhitelistStatus(userId, WhitelistStatus.NOT_ADDED);
        }
      }
      
      return success;
    } catch (error) {
      logger.error('Ошибка при добавлении игрока в белый список:', error);
      // Обновляем статус пользователя на not_added если передан userId
      if (userId) {
        const userRepo = new UserRepository();
        await userRepo.updateWhitelistStatus(userId, WhitelistStatus.NOT_ADDED);
      }
      return false;
    }
  }
  
  /**
   * Удаление игрока из белого списка Minecraft-сервера
   * @param nickname Никнейм игрока
   * @param uuid UUID игрока (опционально)
   * @param userId ID пользователя для обновления статуса
   */
  async removeFromWhitelist(nickname: string, uuid?: string, userId?: number): Promise<boolean> {
    try {
      if (uuid) {
        logger.info(`Удаление игрока ${nickname} (${uuid}) из белого списка`);
      } else {
        logger.info(`Удаление игрока ${nickname} из белого списка`);
      }
      
      // Формируем команду whitelist remove
      const command = `whitelist remove ${nickname}`;
      const response = await this.executeRconCommand(command);
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Проверяем успешность выполнения команды
      const success = response.includes('removed from the whitelist') || 
                      response.includes('удален из белого списка') ||
                      response.includes('Removed') ||
                      response.includes('Player removed from whitelist');
      
      if (success) {
        logger.info(`Игрок ${nickname} успешно удален из белого списка`);
        // Обновляем статус пользователя на removed если передан userId
        if (userId) {
          const userRepo = new UserRepository();
          await userRepo.updateWhitelistStatus(userId, WhitelistStatus.REMOVED);
        }
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
      
      // Выполняем команду whitelist list
      const response = await this.executeRconCommand('whitelist list');
      
      if (!response) {
        throw new Error('Не получен ответ от сервера');
      }
      
      // Логируем полный ответ для отладки
      logger.info(`Ответ от команды 'whitelist list': "${response}"`);
      
      // Извлекаем имена игроков из ответа
      // Примеры форматов ответа:
      // "There are X whitelisted players: player1, player2, ..."
      // "В белом списке находится X игроков: player1, player2, ..."
      // "There are 0 whitelisted players"
      // "Whitelist is empty"
      
      const players: string[] = [];
      
      // Проверяем различные форматы ответа
      let match = response.match(/(?:whitelisted players?\(s\)?:|находится \d+ игроков?:)\s*(.*)/i);
      
      if (!match) {
        // Пробуем другие возможные форматы
        match = response.match(/(?:There are \d+ whitelisted players?\(s\)?:)\s*(.*)/i);
      }
      
      if (!match) {
        // Пробуем формат без двоеточия
        match = response.match(/(?:There are \d+ whitelisted players?\(s\)?)\s+(.*)/i);
      }
      
      if (!match) {
        // Пробуем более общий формат
        match = response.match(/whitelisted.*?:\s*(.*)/i);
      }
      
      if (!match) {
        // Пробуем еще более простой формат для новых версий
        match = response.match(/:\s*(.+)$/i);
      }
      
      if (match && match[1] && match[1].trim()) {
        // Разбиваем строку с именами игроков на массив и очищаем от пробелов
        const playerList = match[1].split(',').map(name => name.trim()).filter(name => name.length > 0);
        players.push(...playerList);
      }
      
      logger.info(`Найдено игроков в whitelist: ${players.length}`);
      if (players.length > 0) {
        logger.info(`Список игроков: ${players.join(', ')}`);
      }
      
      return players;
    } catch (error) {
      logger.error('Ошибка при получении списка игроков в белом списке:', error);
      return null;
    }
  }
  
  /**
   * Проверяет и повторно добавляет пользователей со статусом not_added
   */
  async retryFailedWhitelistAdditions(): Promise<void> {
    try {
      logger.info('Начинаем проверку пользователей со статусом not_added');
      
      // Получаем пользователей со статусом not_added
      const userRepo = new UserRepository();
      const usersNotInWhitelist = await userRepo.findUsersNotInWhitelist();
      
      if (usersNotInWhitelist.length === 0) {
        logger.info('Пользователи со статусом not_added не найдены');
        return;
      }
      
      logger.info(`Найдено ${usersNotInWhitelist.length} пользователей со статусом not_added`);
      
      // Получаем текущий список whitelist с сервера
      const whitelistedPlayers = await this.getWhitelistedPlayers();
      
      if (!whitelistedPlayers || whitelistedPlayers.length === 0) {
        logger.warn('Не удалось получить список whitelist с сервера, пропускаем проверку');
        return;
      }
      
      let retryCount = 0;
      
      // Проверяем каждого пользователя
      for (const user of usersNotInWhitelist) {
        const isInWhitelist = whitelistedPlayers.some(player => 
          player.toLowerCase() === user.minecraftNickname.toLowerCase()
        );
        
        if (isInWhitelist) {
          // Пользователь уже в whitelist, обновляем статус
          logger.info(`Пользователь ${user.minecraftNickname} уже в whitelist, обновляем статус`);
          await userRepo.updateWhitelistStatus(user.id, WhitelistStatus.ADDED);
        } else {
          // Пользователя нет в whitelist, пытаемся добавить
          logger.info(`Пытаемся повторно добавить пользователя ${user.minecraftNickname} в whitelist`);
          const success = await this.addToWhitelist(user.minecraftNickname, user.minecraftUUID || '', user.id);
          
          if (success) {
            retryCount++;
            logger.info(`Пользователь ${user.minecraftNickname} успешно добавлен в whitelist при повторной попытке`);
          } else {
            logger.warn(`Не удалось добавить пользователя ${user.minecraftNickname} в whitelist при повторной попытке`);
          }
        }
      }
      
      logger.info(`Завершена проверка пользователей со статусом not_added. Успешно добавлено: ${retryCount}`);
      
    } catch (error) {
      logger.error('Ошибка при проверке пользователей со статусом not_added:', error);
    }
  }
}