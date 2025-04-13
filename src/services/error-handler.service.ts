import { BotError, GrammyError, HttpError } from 'grammy';
import errorHandler from 'errorhandler';

/**
 * Сервис для обработки ошибок Telegram-бота
 */
export class ErrorHandlerService {
  /**
   * Обработка ошибок запросов Telegram API
   * @param err Объект ошибки
   * @returns true если ошибка обработана, false если требуется дальнейшая обработка
   */
  static handleBotError(err: BotError | any): boolean {
    console.error('Bot Error:', err);

    if (err instanceof GrammyError) {
      // Обработка специфических ошибок Telegram API
      if (err.error_code === 400 && err.description.includes('query is too old')) {
        // Ошибка устаревшего запроса колбэка - это нормально, просто логируем и игнорируем
        console.log('Игнорируем ошибку устаревшего колбэка:', err.description);
        return true;
      } else if (err.error_code === 403 && err.description.includes('bot was blocked by the user')) {
        // Пользователь заблокировал бота
        console.log('Пользователь заблокировал бота:', err.description);
        return true;
      } else if (err.error_code === 429) {
        // Превышен лимит запросов
        console.warn('Превышен лимит запросов к Telegram API:', err.description);
        // Здесь можно добавить задержку перед повторными запросами
        return true;
      }
    } else if (err instanceof HttpError) {
      // Ошибка HTTP, возможно проблемы с подключением
      console.error('HTTP ошибка при запросе к Telegram API:', err);
      return true;
    }

    // Обработка необработанных ошибок
    console.error('Необработанная ошибка бота:', err);
    return false;
  }

  /**
   * Получение Express middleware для обработки ошибок
   * @param isDevelopment Флаг режима разработки
   */
  static getErrorHandler(isDevelopment: boolean = process.env.NODE_ENV !== 'production') {
    return errorHandler({
      log: isDevelopment
    });
  }

  /**
   * Обработка необработанных ошибок Node.js
   */
  static setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
      console.error('Необработанное исключение:', error);
      // Может быть добавлена отправка уведомления администратору
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Необработанное отклонение промиса:', reason);
      // Может быть добавлена отправка уведомления администратору
    });
  }
} 