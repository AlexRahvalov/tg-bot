import { logger } from './logger';

/**
 * Простой in-memory кэш с TTL (Time To Live)
 */
export class Cache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) { // 5 минут по умолчанию
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  /**
   * Получить значение из кэша
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Сохранить значение в кэш
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    const expires = Date.now() + ttl;
    
    this.cache.set(key, { value, expires });
  }

  /**
   * Удалить значение из кэша
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Очистить весь кэш
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Получить или вычислить значение
   */
  async getOrSet<R extends T>(
    key: string, 
    factory: () => Promise<R>, 
    ttlSeconds?: number
  ): Promise<R> {
    const cached = this.get(key) as R;
    
    if (cached !== null) {
      return cached;
    }
    
    try {
      const value = await factory();
      this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      logger.error('Ошибка при получении значения для кэша:', { key, error });
      throw error;
    }
  }

  /**
   * Получить размер кэша
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Очистить просроченные записи
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
}

// Глобальные экземпляры кэша для разных типов данных
export const applicationCache = new Cache(300); // 5 минут
export const voteCache = new Cache(60); // 1 минута
export const userCache = new Cache(600); // 10 минут

// Автоматическая очистка кэша каждые 5 минут
let cacheCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Запуск автоматической очистки кэша
 */
export function startCacheCleanup(): void {
  if (cacheCleanupInterval) {
    return; // Уже запущен
  }
  
  cacheCleanupInterval = setInterval(() => {
    const removedApps = applicationCache.cleanup();
    const removedVotes = voteCache.cleanup();
    const removedUsers = userCache.cleanup();
    
    if (removedApps + removedVotes + removedUsers > 0) {
      logger.debug(`Очищено записей из кэша: приложения=${removedApps}, голоса=${removedVotes}, пользователи=${removedUsers}`);
    }
  }, 5 * 60 * 1000);
  
  logger.info('✅ Автоматическая очистка кэша запущена');
}

/**
 * Остановка автоматической очистки кэша
 */
export function stopCacheCleanup(): void {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
    logger.info('🛑 Автоматическая очистка кэша остановлена');
  }
}

// Запускаем очистку при импорте модуля
startCacheCleanup();

/**
 * Утилиты для работы с кэшем
 */
export class CacheUtils {
  /**
   * Генерирует ключ кэша для заявки
   */
  static applicationKey(id: number): string {
    return `app:${id}`;
  }

  /**
   * Генерирует ключ кэша для голоса пользователя
   */
  static userVoteKey(applicationId: number, voterId: number): string {
    return `user_vote:${applicationId}:${voterId}`;
  }

  /**
   * Генерирует ключ кэша для списка голосов по заявке
   */
  static applicationVotesKey(applicationId: number): string {
    return `votes:${applicationId}`;
  }

  /**
   * Генерирует ключ кэша для активных заявок пользователя
   */
  static userActiveApplicationsKey(userId: number): string {
    return `user_active_applications:${userId}`;
  }

  /**
   * Инвалидирует связанные с заявкой кэши
   */
  static invalidateApplicationCaches(applicationId: number, userId?: number): void {
    // Инвалидируем кэш заявки
    applicationCache.delete(this.applicationKey(applicationId));
    
    // Инвалидируем кэш активных заявок пользователя
    if (userId) {
      applicationCache.delete(this.userActiveApplicationsKey(userId));
    }
    
    // Инвалидируем общие кэши
    applicationCache.delete('active_applications');
    applicationCache.delete('voting_applications');
  }

  /**
   * Инвалидирует кэши голосов
   */
  static invalidateVoteCaches(applicationId: number, voterId: number): void {
    // Инвалидируем кэш голоса пользователя
    voteCache.delete(this.userVoteKey(applicationId, voterId));
    
    // Инвалидируем кэш голосов по заявке
    voteCache.delete(`votes:${applicationId}`);
  }
}