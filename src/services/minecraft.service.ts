import { status, RCON } from 'minecraft-server-util';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

/**
 * Конфигурация для Minecraft-сервера
 */
interface MinecraftConfig {
  host: string;
  port: number;
  rconPort: number;
  rconPassword: string;
  timeout: number;
}

/**
 * Сервис для работы с Minecraft-сервером
 */
export class MinecraftService {
  private config: MinecraftConfig;

  constructor() {
    this.config = {
      host: process.env.MINECRAFT_HOST || 'localhost',
      port: Number(process.env.MINECRAFT_PORT) || 25565,
      rconPort: Number(process.env.MINECRAFT_RCON_PORT) || 25575,
      rconPassword: process.env.MINECRAFT_RCON_PASSWORD || '',
      timeout: 5000
    };
  }

  /**
   * Проверка состояния сервера
   * @returns Информация о состоянии сервера
   */
  async getServerStatus() {
    try {
      const result = await status(this.config.host, this.config.port, { timeout: this.config.timeout });
      return {
        online: true,
        version: result.version.name,
        players: {
          online: result.players.online,
          max: result.players.max
        },
        motd: result.motd.clean
      };
    } catch (error) {
      console.error('Ошибка при получении статуса сервера:', error);
      return {
        online: false,
        error: 'Не удалось подключиться к серверу'
      };
    }
  }

  /**
   * Получение UUID игрока в Minecraft
   * @param username - Имя игрока
   * @returns UUID игрока или null, если игрок не найден
   */
  async getPlayerUUID(username: string): Promise<string | null> {
    try {
      // Для серверов в режиме offline (online-mode=false) 
      // всегда используем оффлайн UUID
      return this.generateOfflineUUID(username);
      
      // Код ниже не используется, так как сервер работает в режиме offline
      /*
      // Попытка получить UUID через официальный API Mojang
      const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      
      if (response.status === 200) {
        const data = await response.json() as { id: string };
        return data.id;
      }
      
      // Если игрок не найден в API Mojang, используем оффлайн UUID
      return this.generateOfflineUUID(username);
      */
    } catch (error) {
      console.error('Ошибка при получении UUID игрока:', error);
      return this.generateOfflineUUID(username);
    }
  }

  /**
   * Генерация оффлайн UUID для игрока
   * Для оффлайн-сервера используется MD5 хеш "OfflinePlayer:" + username
   * @param username - Имя игрока
   * @returns Оффлайн UUID
   */
  private generateOfflineUUID(username: string): string {
    // По спецификации Minecraft для оффлайн UUID используется алгоритм:
    // "OfflinePlayer:" + username -> MD5 -> UUID
    // Первые 12 цифр UUID v3 заменяются на "OfflinePlayer:"
    const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex');
    
    // Форматирование в UUID формат (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    // Для оффлайн-режима нужно также установить определенные биты,
    // чтобы соответствовать формату UUID версии 3
    let formattedUUID = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    
    // Модификация для соответствия формату UUID версии 3 (установка битов версии)
    const chars = formattedUUID.split('');
    chars[14] = '3'; // Устанавливаем версию UUID в 3
    
    // Устанавливаем определенные биты в соответствии со спецификацией UUID
    const hexDigit = parseInt(chars[19], 16);
    chars[19] = (8 + (hexDigit & 3)).toString(16); // Установка битов варианта UUID
    
    return chars.join('');
  }

  /**
   * Добавление игрока в белый список сервера
   * @param username - Имя игрока
   * @param uuid - UUID игрока
   * @returns true, если игрок успешно добавлен
   */
  async addToWhitelist(username: string, uuid: string): Promise<boolean> {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`Попытка ${retryCount + 1}/${maxRetries} добавления игрока в белый список: ${username}`);
        console.log(`Подключение к RCON: ${this.config.host}:${this.config.rconPort}`);
        
        // Подключение к RCON
        const rcon = new RCON();
        
        // Увеличиваем таймаут соединения
        const connectionTimeout = 10000; // 10 секунд
        
        // Подключаемся с увеличенным таймаутом
        await rcon.connect(this.config.host, this.config.rconPort, { timeout: connectionTimeout });
        console.log('RCON: Соединение установлено');
        
        await rcon.login(this.config.rconPassword);
        console.log('RCON: Аутентификация успешна');

        // Выполнение команды whitelist add
        const response = await rcon.execute(`whitelist add ${username}`);
        console.log(`RCON: Получен ответ: ${response}`);
        
        // Закрытие соединения
        await rcon.close();
        console.log('RCON: Соединение закрыто');

        // Проверка успешности выполнения команды
        return response.includes('to the whitelist') || response.includes('already whitelisted');
      } catch (error) {
        lastError = error;
        console.error(`Попытка ${retryCount + 1}/${maxRetries} добавления игрока в белый список не удалась:`, error);
        
        // Если ошибка связана с подключением, ждем перед следующей попыткой
        if (
          error instanceof Error && 
          (
            error.message.includes('connect') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          )
        ) {
          const waitTime = 2000 * (retryCount + 1); // Экспоненциальное увеличение задержки
          console.log(`Ожидание ${waitTime}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Если ошибка не связана с подключением, не пытаемся снова
          break;
        }
        
        retryCount++;
      }
    }

    console.error('Не удалось добавить игрока в белый список после всех попыток:', lastError);
    return false;
  }

  /**
   * Удаление игрока из белого списка сервера
   * @param username - Имя игрока
   * @returns true, если игрок успешно удален
   */
  async removeFromWhitelist(username: string): Promise<boolean> {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`Попытка ${retryCount + 1}/${maxRetries} удаления игрока из белого списка: ${username}`);
        console.log(`Подключение к RCON: ${this.config.host}:${this.config.rconPort}`);
        
        // Подключение к RCON
        const rcon = new RCON();
        
        // Увеличиваем таймаут соединения
        const connectionTimeout = 10000; // 10 секунд
        
        // Подключаемся с увеличенным таймаутом
        await rcon.connect(this.config.host, this.config.rconPort, { timeout: connectionTimeout });
        console.log('RCON: Соединение установлено');
        
        await rcon.login(this.config.rconPassword);
        console.log('RCON: Аутентификация успешна');

        // Выполнение команды whitelist remove
        const response = await rcon.execute(`whitelist remove ${username}`);
        console.log(`RCON: Получен ответ: ${response}`);
        
        // Закрытие соединения
        await rcon.close();
        console.log('RCON: Соединение закрыто');

        // Проверка успешности выполнения команды
        return response.includes('from the whitelist');
      } catch (error) {
        lastError = error;
        console.error(`Попытка ${retryCount + 1}/${maxRetries} удаления игрока из белого списка не удалась:`, error);
        
        // Если ошибка связана с подключением, ждем перед следующей попыткой
        if (
          error instanceof Error && 
          (
            error.message.includes('connect') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          )
        ) {
          const waitTime = 2000 * (retryCount + 1); // Экспоненциальное увеличение задержки
          console.log(`Ожидание ${waitTime}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Если ошибка не связана с подключением, не пытаемся снова
          break;
        }
        
        retryCount++;
      }
    }

    console.error('Не удалось удалить игрока из белого списка после всех попыток:', lastError);
    return false;
  }

  /**
   * Получение списка игроков в белом списке
   * @returns Массив имен игроков или null в случае ошибки
   */
  async getWhitelistedPlayers(): Promise<string[] | null> {
    try {
      // Сначала пробуем получить список через RCON
      const rconResult = await this.getWhitelistedPlayersViaRCON();
      if (rconResult !== null && rconResult.length > 0) {
        console.log('Успешно получен список игроков через RCON:', rconResult);
        return rconResult;
      }
      
      // Если RCON не сработал или вернул пустой список, пробуем прочитать из файла
      const fileResult = await this.getWhitelistedPlayersFromFile();
      if (fileResult !== null && fileResult.length > 0) {
        console.log('Успешно получен список игроков из файла whitelist.json:', fileResult);
        return fileResult;
      }
      
      // Если ни один метод не сработал, возвращаем пустой массив
      console.warn('Не удалось получить список игроков ни через RCON, ни из файла');
      return [];
    } catch (error) {
      console.error('Ошибка при получении списка игроков в белом списке:', error);
      return [];
    }
  }

  /**
   * Получение списка игроков в белом списке через RCON
   * @returns Массив имен игроков или null в случае ошибки
   */
  private async getWhitelistedPlayersViaRCON(): Promise<string[] | null> {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`Попытка ${retryCount + 1}/${maxRetries} получения списка игроков из белого списка через RCON`);
        console.log(`Подключение к RCON: ${this.config.host}:${this.config.rconPort}`);
        
        // Подключение к RCON
        const rcon = new RCON();
        
        // Увеличиваем таймаут соединения
        const connectionTimeout = 10000; // 10 секунд
        
        // Подключаемся с увеличенным таймаутом
        await rcon.connect(this.config.host, this.config.rconPort, { timeout: connectionTimeout });
        console.log('RCON: Соединение установлено');
        
        await rcon.login(this.config.rconPassword);
        console.log('RCON: Аутентификация успешна');

        // Выполнение команды whitelist list
        const response = await rcon.execute('whitelist list');
        console.log(`RCON: Получен ответ: ${response}`);
        
        // Закрытие соединения
        await rcon.close();
        console.log('RCON: Соединение закрыто');

        // Парсинг ответа для получения списка игроков
        // Формат ответа может различаться в зависимости от версии сервера:
        // "There are X whitelisted players: player1, player2, player3"
        // "White-listed players (X): player1, player2, player3"
        // "There are X whitelisted player(s): player1, player2, player3"
        
        // Общий регулярный шаблон для всех форматов
        const matchAny = /(?:There are \d+ whitelisted players?(?:\(s\))?:|White-listed players \(\d+\):) (.+)/;
        const matchPlayerList = response.match(matchAny);
        
        // Если не сработал общий шаблон, пробуем более конкретные варианты
        if (!matchPlayerList) {
          // Конкретный шаблон для формата "There are X whitelisted player(s): ..."
          const matchSpecific = response.match(/There are \d+ whitelisted player\(s\): (.+)/);
          if (matchSpecific && matchSpecific[1]) {
            return matchSpecific[1].split(', ').map(name => name.trim());
          }
        } else if (matchPlayerList && matchPlayerList[1]) {
          // Убираем лишние пробелы и возвращаем массив имен
          return matchPlayerList[1].split(', ').map(name => name.trim());
        }
        
        // Если сервер ответил, но игроков в вайтлисте нет
        if (response.includes('There are 0 whitelisted players') || 
            response.includes('White-listed players (0)')) {
          return [];
        }
        
        // Если не смогли распарсить ответ, возможно формат другой
        console.warn('Не удалось распарсить ответ сервера:', response);
        return null;
      } catch (error) {
        lastError = error;
        console.error(`Попытка ${retryCount + 1}/${maxRetries} получения списка игроков через RCON не удалась:`, error);
        
        // Если ошибка связана с подключением, ждем перед следующей попыткой
        if (
          error instanceof Error && 
          (
            error.message.includes('connect') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          )
        ) {
          const waitTime = 2000 * (retryCount + 1); // Экспоненциальное увеличение задержки
          console.log(`Ожидание ${waitTime}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Если ошибка не связана с подключением, не пытаемся снова
          break;
        }
        
        retryCount++;
      }
    }

    console.error('Не удалось получить список игроков через RCON после всех попыток:', lastError);
    return null;
  }

  /**
   * Получение списка игроков в белом списке из файла whitelist.json
   * @returns Массив имен игроков или null в случае ошибки
   */
  private async getWhitelistedPlayersFromFile(): Promise<string[] | null> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Пути для поиска файла whitelist.json
      const possiblePaths = [
        process.env.WHITELIST_PATH, // Из переменных окружения
        './whitelist.json', // В текущей директории
        '../whitelist.json', // Уровнем выше
        './server/whitelist.json', // В подкаталоге server
        './minecraft/whitelist.json', // В подкаталоге minecraft
      ];
      
      let whitelistPath = null;
      for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
          whitelistPath = p;
          break;
        }
      }
      
      // Если whitelist.json не найден в стандартных местах, ищем его в директории сервера
      if (!whitelistPath && process.env.MINECRAFT_SERVER_PATH) {
        const serverPath = process.env.MINECRAFT_SERVER_PATH;
        const customPath = path.join(serverPath, 'whitelist.json');
        if (fs.existsSync(customPath)) {
          whitelistPath = customPath;
        }
      }
      
      if (!whitelistPath) {
        console.error('Не удалось найти файл whitelist.json');
        return null;
      }
      
      console.log(`Чтение файла whitelist.json из ${whitelistPath}`);
      const whitelistData = fs.readFileSync(whitelistPath, 'utf8');
      const whitelist = JSON.parse(whitelistData);
      
      if (Array.isArray(whitelist)) {
        // Извлекаем имена игроков из объектов whitelist
        return whitelist.map(entry => entry.name);
      }
      
      return [];
    } catch (error) {
      console.error('Ошибка при чтении файла whitelist.json:', error);
      return null;
    }
  }

  /**
   * Тестирование соединения с RCON-сервером
   * @returns true, если соединение успешно установлено
   */
  async testRconConnection(): Promise<boolean> {
    try {
      console.log(`Тестирование соединения с RCON-сервером: ${this.config.host}:${this.config.rconPort}`);
      const result = await this.executeRconCommand('say RCON test connection');
      return result !== null;
    } catch (error) {
      console.error('Ошибка при тестировании соединения с RCON:', error);
      return false;
    }
  }

  /**
   * Общая функция для выполнения RCON-команд с ретраями
   * @param command Команда для выполнения
   * @returns Результат выполнения команды или null в случае ошибки
   */
  private async executeRconCommand(command: string): Promise<string | null> {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`Попытка ${retryCount + 1}/${maxRetries} выполнения команды: ${command}`);
        console.log(`Подключение к RCON: ${this.config.host}:${this.config.rconPort}`);
        
        // Подключение к RCON
        const rcon = new RCON();
        
        // Увеличиваем таймаут соединения
        const connectionTimeout = 10000; // 10 секунд
        
        // Подключаемся с увеличенным таймаутом
        await rcon.connect(this.config.host, this.config.rconPort, { timeout: connectionTimeout });
        console.log('RCON: Соединение установлено');
        
        await rcon.login(this.config.rconPassword);
        console.log('RCON: Аутентификация успешна');

        // Выполнение команды
        const response = await rcon.execute(command);
        console.log(`RCON: Получен ответ: ${response}`);
        
        // Закрытие соединения
        await rcon.close();
        console.log('RCON: Соединение закрыто');

        return response;
      } catch (error) {
        lastError = error;
        console.error(`Попытка ${retryCount + 1}/${maxRetries} выполнения команды не удалась:`, error);
        
        // Если ошибка связана с подключением, ждем перед следующей попыткой
        if (
          error instanceof Error && 
          (
            error.message.includes('connect') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          )
        ) {
          const waitTime = 2000 * (retryCount + 1); // Экспоненциальное увеличение задержки
          console.log(`Ожидание ${waitTime}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Если ошибка не связана с подключением, не пытаемся снова
          break;
        }
        
        retryCount++;
      }
    }

    console.error('Не удалось выполнить команду после всех попыток:', lastError);
    return null;
  }
} 