import { Bot } from 'grammy';
import { logger } from '../utils/logger';
import { VotingService } from './votingService';
import { RatingService } from './ratingService';
import type { MyContext } from '../models/sessionTypes';

/**
 * Простой контейнер зависимостей для управления сервисами
 */
class ServiceContainer {
  private services: Map<string, any> = new Map();
  private initialized: boolean = false;
  
  /**
   * Регистрирует сервис в контейнере
   * @param name Имя сервиса
   * @param service Экземпляр сервиса
   */
  register<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      logger.warn(`Сервис с именем "${name}" уже зарегистрирован. Будет заменен.`);
    }
    
    this.services.set(name, service);
    logger.debug(`✅ Сервис "${name}" зарегистрирован`);
  }
  
  /**
   * Получает зарегистрированный сервис по имени
   * @param name Имя сервиса
   * @returns Экземпляр сервиса
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Сервис "${name}" не найден в контейнере`);
    }
    
    return service as T;
  }
  
  /**
   * Инициализирует базовые сервисы приложения
   * @param bot Экземпляр бота
   */
  initializeServices(bot: Bot<MyContext>): void {
    if (this.initialized) {
      logger.warn('Сервисы уже были инициализированы');
      return;
    }
    
    // Создаем экземпляры сервисов
    const votingService = new VotingService(bot);
    const ratingService = this.get<RatingService>('ratingService');
    
    // Устанавливаем экземпляр бота в сервисы
    ratingService.setBotInstance(bot);
    
    // Регистрируем сервисы
    this.register('votingService', votingService);
    
    this.initialized = true;
    logger.info('✅ Сервисы успешно инициализированы');
  }
  
  /**
   * Проверяет, инициализированы ли сервисы
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Экспортируем синглтон
export const serviceContainer = new ServiceContainer(); 