import type { SessionFlavor } from 'grammy';
import type { Context } from 'grammy';
import { RatingType } from '../index';
import type { User } from './types';

/**
 * Интерфейс для состояния подачи заявки
 */
export interface ApplyState {
  step: string;
  minecraftNickname?: string;
  reason?: string;
}

/**
 * Интерфейс для состояния оценки пользователя
 */
export interface RatingState {
  targetUserId: number;
  ratingType: RatingType;
  step: string;
}

/**
 * Интерфейс для настроек голосования
 */
export interface VotingSettings {
  days: number;
  hours: number;
  minutes: number;
}

/**
 * Интерфейс для данных сессии
 */
export interface SessionData {
  // Состояние процесса подачи заявки
  applyState?: ApplyState;
  
  // Состояние процесса оценки пользователя
  ratingState?: RatingState;
  
  // Идентификаторы для работы с заявками
  applicationId?: number;
  questionId?: number;
  targetUserId?: number;
  
  // Настройки голосования
  votingSettings?: VotingSettings;
  minVotesRequired?: number;
  negativeThreshold?: number;
  
  // ID заявки для задания вопроса
  askQuestionAppId?: number;
  
  // Текущий шаг в диалоге
  step?: string;
  
  // Данные формы заявки
  form?: {
    minecraftNickname?: string;
    reason?: string;
    [key: string]: any;
  };
  
  // Флаг для отслеживания обработанных сообщений
  __processed?: boolean;
}

/**
 * Интерфейс для состояния контекста
 */
export interface ContextState {
  user?: User;
  [key: string]: any;
}

/**
 * Тип контекста с сессией и состоянием
 */
export type MyContext = Context & SessionFlavor<SessionData> & {
  state: ContextState;
};

/**
 * Вспомогательные функции для работы с сессией
 */

/**
 * Сбрасывает состояние оценки
 */
export function resetRatingState(ctx: MyContext): void {
  ctx.session.ratingState = undefined;
}

/**
 * Устанавливает состояние оценки
 */
export function setRatingState(ctx: MyContext, targetUserId: number, ratingType: RatingType): void {
  ctx.session.ratingState = {
    targetUserId,
    ratingType,
    step: 'awaiting_reason'
  };
}

/**
 * Сбрасывает состояние подачи заявки
 */
export function resetApplyState(ctx: MyContext): void {
  ctx.session.applyState = undefined;
  ctx.session.step = undefined;
  ctx.session.form = undefined;
}

/**
 * Начинает процесс подачи заявки
 */
export function startApplyProcess(ctx: MyContext): void {
  ctx.session.applyState = {
    step: 'waiting_nickname'
  };
  ctx.session.step = 'waiting_nickname';
}

/**
 * Проверяет, обрабатывалось ли сообщение
 */
export function isProcessed(ctx: MyContext): boolean {
  return !!ctx.session.__processed;
}

/**
 * Отмечает сообщение как обработанное
 */
export function markAsProcessed(ctx: MyContext): void {
  ctx.session.__processed = true;
} 