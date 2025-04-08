import { logger } from '../utils/logger';

/**
 * Тип функции-обработчика событий
 */
type EventListener = (...args: any[]) => void | Promise<void>;

/**
 * Класс для реализации паттерна Observer (EventEmitter)
 * Позволяет организовать коммуникацию между сервисами
 */
class EventEmitter {
  private listeners: Map<string, EventListener[]> = new Map();
  
  /**
   * Подписывает обработчик на событие
   * @param event Название события
   * @param listener Функция-обработчик
   */
  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(listener);
    logger.debug(`Добавлен обработчик для события "${event}"`);
  }
  
  /**
   * Вызывает все обработчики события
   * @param event Название события
   * @param args Аргументы для передачи обработчикам
   */
  async emit(event: string, ...args: any[]): Promise<void> {
    const eventListeners = this.listeners.get(event) || [];
    
    if (eventListeners.length === 0) {
      logger.debug(`Событие "${event}" вызвано, но для него нет обработчиков`);
      return;
    }
    
    logger.debug(`Событие "${event}" вызвано с ${eventListeners.length} обработчиками`);
    
    const promises = eventListeners.map(async (listener) => {
      try {
        const result = listener(...args);
        
        // Обрабатываем как Promise, если это Promise
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        logger.error(`Ошибка в обработчике события "${event}":`, error);
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Удаляет обработчик с события
   * @param event Название события
   * @param listener Функция-обработчик для удаления
   */
  off(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event)!;
    const index = eventListeners.indexOf(listener);
    
    if (index !== -1) {
      eventListeners.splice(index, 1);
      logger.debug(`Удален обработчик для события "${event}"`);
    }
    
    // Если больше нет обработчиков, удаляем запись о событии
    if (eventListeners.length === 0) {
      this.listeners.delete(event);
    }
  }
  
  /**
   * Удаляет все обработчики для указанного события
   * @param event Название события
   */
  removeAllListeners(event: string): void {
    if (this.listeners.has(event)) {
      this.listeners.delete(event);
      logger.debug(`Удалены все обработчики для события "${event}"`);
    }
  }
  
  /**
   * Получает количество обработчиков для события
   * @param event Название события
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

// Экспортируем синглтон
export const events = new EventEmitter();

// Константы событий для использования в приложении
export const EVENT_TYPES = {
  // События пользователей
  USER: {
    CREATED: 'user.created',
    UPDATED: 'user.updated',
    ROLE_CHANGED: 'user.role_changed',
    REPUTATION_CHANGED: 'user.reputation_changed',
  },
  
  // События заявок
  APPLICATION: {
    CREATED: 'application.created',
    STATUS_CHANGED: 'application.status_changed',
    APPROVED: 'application.approved',
    REJECTED: 'application.rejected',
    VOTING_STARTED: 'application.voting_started',
    VOTING_ENDED: 'application.voting_ended',
  },
  
  // События голосований
  VOTE: {
    ADDED: 'vote.added',
    REMOVED: 'vote.removed',
  },
  
  // События оценок
  RATING: {
    ADDED: 'rating.added',
    REMOVED: 'rating.removed',
  },
  
  // События сервера
  SERVER: {
    WHITELIST_UPDATED: 'server.whitelist_updated',
    CONNECTION_ERROR: 'server.connection_error',
    STATUS_CHANGED: 'server.status_changed',
  },
}; 