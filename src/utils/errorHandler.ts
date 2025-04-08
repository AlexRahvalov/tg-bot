import type { MyContext } from "../models/sessionTypes";
import { logger } from "./logger";

/**
 * Обертка для обработчиков команд и событий, которая ловит и логирует ошибки
 * @param handler Функция-обработчик, которую нужно обернуть
 * @returns Обернутая функция-обработчик с обработкой ошибок
 */
export function handleError<T extends MyContext>(
  handler: (ctx: T) => Promise<void>
) {
  return async (ctx: T, next?: () => Promise<void>) => {
    try {
      await handler(ctx);
    } catch (error) {
      // Логируем ошибку
      logger.error(`Ошибка при обработке обновления: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      
      // Отправляем уведомление пользователю, если это возможно
      try {
        await ctx.reply(
          "😔 Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже или обратитесь к администратору."
        );
      } catch (replyError) {
        logger.error(`Не удалось отправить сообщение об ошибке: ${replyError instanceof Error ? replyError.message : String(replyError)}`);
      }
    } finally {
      if (next) {
        await next();
      }
    }
  };
}

/**
 * Функция обработки ошибок, которая принимает контекст, ошибку и метку операции
 * @param ctx Контекст сообщения
 * @param error Объект ошибки
 * @param operation Название операции, в которой произошла ошибка
 */
export async function handleErrorWithContext(
  ctx: MyContext,
  error: unknown,
  operation: string
): Promise<void> {
  // Логируем ошибку с указанием операции
  logger.error(`Ошибка в операции "${operation}":`, error);
  if (error instanceof Error && error.stack) {
    logger.debug(error.stack);
  }
  
  // Отправляем уведомление пользователю, если это возможно
  try {
    await ctx.reply(
      "😔 Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже или обратитесь к администратору."
    );
  } catch (replyError) {
    logger.error('Не удалось отправить сообщение об ошибке:', replyError);
  }
}

/**
 * Обрабатывает ошибку без контекста, только логирует
 * @param error Объект ошибки
 */
export function logError(error: any): void {
  logger.error('Ошибка:', error);
}

/**
 * Обертка для автоматической обработки ошибок в обработчиках
 * @param handler Функция-обработчик
 * @param operationName Название операции для логирования
 * @returns Функция-обработчик с встроенной обработкой ошибок
 */
export function withErrorHandling(handler: (ctx: MyContext) => Promise<void>, operationName: string) {
  return async (ctx: MyContext) => {
    try {
      await handler(ctx);
    } catch (error) {
      await handleErrorWithContext(ctx, error, operationName);
    }
  };
}

/**
 * Обертка для обработки ошибок в middleware
 * @param handler Функция middleware
 * @param operationName Название операции для логирования
 * @returns Функция middleware с встроенной обработкой ошибок
 */
export function withMiddlewareErrorHandling<T>(
  handler: (ctx: MyContext, next: () => Promise<void>) => Promise<T>,
  operationName: string
) {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    try {
      await handler(ctx, next);
    } catch (error) {
      await handleErrorWithContext(ctx, error, operationName);
    }
  };
} 