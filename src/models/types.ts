/**
 * Статус заявки на вступление
 */
export enum ApplicationStatus {
  PENDING = 'pending',       // На рассмотрении
  VOTING = 'voting',         // На голосовании
  APPROVED = 'approved',     // Одобрена
  REJECTED = 'rejected',     // Отклонена
  EXPIRED = 'expired'        // Истёк срок голосования
}

/**
 * Тип голоса
 */
export enum VoteType {
  POSITIVE = 'positive',     // Положительный
  NEGATIVE = 'negative'      // Отрицательный
}

/**
 * Роль пользователя
 */
export enum UserRole {
  APPLICANT = 'applicant',   // Заявитель
  MEMBER = 'member',         // Участник
  ADMIN = 'admin'            // Администратор
}

/**
 * Интерфейс пользователя
 */
export interface User {
  id: number;                // ID пользователя в БД
  telegramId: number;        // Telegram ID пользователя
  username?: string;         // Имя пользователя в Telegram
  minecraftNickname: string; // Никнейм в Minecraft
  minecraftUUID?: string;    // UUID игрока в Minecraft
  role: UserRole;            // Роль пользователя
  canVote: boolean;          // Имеет право голосовать
  reputation: number;        // Репутация пользователя
  createdAt: Date;           // Дата создания
  updatedAt: Date;           // Дата обновления
}

/**
 * Интерфейс заявки на вступление
 */
export interface Application {
  id: number;                // ID заявки в БД
  userId: number;            // ID пользователя в БД
  minecraftNickname: string; // Никнейм в Minecraft
  reason: string;            // Причина вступления
  status: ApplicationStatus; // Статус заявки
  votingEndsAt?: Date;       // Дата окончания голосования
  positiveVotes: number;     // Количество положительных голосов
  negativeVotes: number;     // Количество отрицательных голосов
  createdAt: Date;           // Дата создания
  updatedAt: Date;           // Дата обновления
}

/**
 * Интерфейс голоса
 */
export interface Vote {
  id: number;                // ID голоса в БД
  applicationId: number;     // ID заявки
  voterId: number;           // ID голосующего 
  voteType: VoteType;        // Тип голоса
  createdAt: Date;           // Дата создания
}

/**
 * Интерфейс вопроса к заявке
 */
export interface Question {
  id: number;                // ID вопроса в БД
  applicationId: number;     // ID заявки
  askerId: number;           // ID задавшего вопрос
  text: string;              // Текст вопроса
  answer?: string;           // Ответ на вопрос
  answeredAt?: Date;         // Дата ответа
  createdAt: Date;           // Дата создания
  updatedAt: Date;           // Дата обновления
}

/**
 * Интерфейс оценки участника
 */
export interface Rating {
  id: number;                // ID оценки в БД
  targetUserId: number;      // ID оцениваемого пользователя
  raterId: number;           // ID оценивающего
  isPositive: boolean;       // Положительная ли оценка
  createdAt: Date;           // Дата создания
}

/**
 * Интерфейс настроек системы
 */
export interface SystemSettings {
  votingDurationHours: number;     // Продолжительность голосования в часах (0-23)
  votingDurationDays: number;      // Продолжительность голосования в днях
  votingDurationMinutes: number;   // Продолжительность голосования в минутах
  minVotesRequired: number;        // Минимальное количество голосов для принятия решения
  negativeRatingsThreshold: number; // Порог отрицательных оценок для исключения
} 