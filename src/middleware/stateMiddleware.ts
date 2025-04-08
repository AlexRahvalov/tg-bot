import type { MyContext } from '../models/sessionTypes';

/**
 * Middleware для инициализации state в контексте
 * Гарантирует, что ctx.state всегда будет объектом
 */
export const initStateMiddleware = async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
  // Инициализируем state, если его еще нет
  ctx.state = ctx.state || {};
  await next();
}; 