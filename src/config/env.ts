import * as dotenv from 'dotenv';
import { join } from 'path';
import { logger } from '../utils/logger';

// Загружаем переменные окружения из .env файла
dotenv.config();

const config = {
  // Токен Telegram-бота
  botToken: process.env.BOT_TOKEN || '',
  
  // ID администратора в Telegram
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '',
  
  // Настройки базы данных
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'minecraft_bot',
  },
  
  // Настройки Minecraft-сервера
  minecraft: {
    host: process.env.MINECRAFT_HOST || 'localhost',
    rconPort: parseInt(process.env.MINECRAFT_RCON_PORT || '25575', 10),
    rconPassword: process.env.MINECRAFT_RCON_PASSWORD || '',
  },
  
  // Информация о сервере для отображения
  server: {
    displayIp: process.env.SERVER_DISPLAY_IP || process.env.MINECRAFT_HOST || 'localhost',
    version: process.env.SERVER_VERSION || '1.20.2',
    gamemode: process.env.SERVER_GAMEMODE || 'Выживание',
    accessType: process.env.SERVER_ACCESS_TYPE || 'Демократический белый список',
  },
  
  // Настройки приложения
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.APP_PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    sessionTTL: parseInt(process.env.SESSION_TTL || '86400'), // Время жизни сессии по умолчанию - 24 часа
  },
  
  // Настройки голосования
  voting: {
    defaultDurationDays: parseInt(process.env.VOTING_DURATION_DAYS || '1'),
    defaultDurationHours: parseInt(process.env.VOTING_DURATION_HOURS || '0'),
    defaultDurationMinutes: parseInt(process.env.VOTING_DURATION_MINUTES || '0'),
    defaultMinVotesRequired: parseInt(process.env.MIN_VOTES_REQUIRED || '3'),
  },
};

// Проверяем наличие обязательных конфигурационных параметров
if (!config.botToken) {
  logger.error('Ошибка: Не указан токен Telegram-бота (BOT_TOKEN)');
  process.exit(1);
}

export default config;