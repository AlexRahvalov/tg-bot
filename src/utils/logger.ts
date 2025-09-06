import * as fs from 'fs';
import * as path from 'path';

/**
 * Уровни логирования
 */
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Утилита логирования для приложения
 */
class Logger {
  private level: LogLevel;
  private logDir: string;
  
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }
  
  /**
   * Создание директории для логов, если она не существует
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  /**
   * Безопасная сериализация объектов, включая значения BigInt
   * @param obj Объект для сериализации
   * @returns Строковое представление объекта
   */
  private safeStringify(obj: any): string {
    if (obj === undefined) return 'undefined';
    if (obj === null) return 'null';
    if (typeof obj !== 'object') return String(obj);
    
    try {
      return JSON.stringify(obj, (_, value) => {
        // Преобразуем BigInt в строку
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      });
    } catch (error) {
      // Если JSON.stringify не сработал, возвращаем простое представление
      return `[Object ${obj.constructor?.name || typeof obj}]`;
    }
  }
  
  /**
   * Запись в файл лога
   */
  private writeToFile(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${level}] ${timestamp}: ${message}\n`;
    const logFile = path.join(this.logDir, `${level.toLowerCase()}.log`);
    
    fs.appendFileSync(logFile, logMessage);
  }
  
  /**
   * Установка уровня логирования
   * @param level Уровень логирования
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  /**
   * Логирование ошибки
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  error(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      const errorMessage = `${message} ${optionalParams.map(p => this.safeStringify(p)).join(' ')}`;
      console.error(`[ERROR] ${new Date().toISOString()}:`, message, ...optionalParams);
      this.writeToFile('ERROR', errorMessage);
    }
  }
  
  /**
   * Логирование предупреждения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  warn(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.WARN) {
      const warnMessage = `${message} ${optionalParams.map(p => this.safeStringify(p)).join(' ')}`;
      console.warn(`[WARN] ${new Date().toISOString()}:`, message, ...optionalParams);
      this.writeToFile('WARN', warnMessage);
    }
  }
  
  /**
   * Логирование информационного сообщения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  info(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.INFO) {
      const infoMessage = `${message} ${optionalParams.map(p => this.safeStringify(p)).join(' ')}`;
      console.info(`[INFO] ${new Date().toISOString()}:`, message, ...optionalParams);
      this.writeToFile('INFO', infoMessage);
    }
  }
  
  /**
   * Логирование отладочного сообщения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  debug(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      const debugMessage = `${message} ${optionalParams.map(p => this.safeStringify(p)).join(' ')}`;
      console.debug(`[DEBUG] ${new Date().toISOString()}:`, message, ...optionalParams);
      this.writeToFile('DEBUG', debugMessage);
    }
  }
}

// Создаем и экспортируем экземпляр логгера с настройками из переменных окружения
const logLevel = process.env.LOG_LEVEL 
  ? (LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO)
  : LogLevel.INFO;

export const logger = new Logger(logLevel); 