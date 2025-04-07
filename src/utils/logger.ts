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
  
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
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
      console.error(`[ERROR] ${new Date().toISOString()}:`, message, ...optionalParams);
    }
  }
  
  /**
   * Логирование предупреждения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  warn(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()}:`, message, ...optionalParams);
    }
  }
  
  /**
   * Логирование информационного сообщения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  info(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${new Date().toISOString()}:`, message, ...optionalParams);
    }
  }
  
  /**
   * Логирование отладочного сообщения
   * @param message Сообщение или объект для логирования
   * @param optionalParams Дополнительные параметры для логирования
   */
  debug(message: any, ...optionalParams: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${new Date().toISOString()}:`, message, ...optionalParams);
    }
  }
}

// Создаем и экспортируем экземпляр логгера с настройками из переменных окружения
const logLevel = process.env.LOG_LEVEL 
  ? (LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO)
  : LogLevel.INFO;

export const logger = new Logger(logLevel); 