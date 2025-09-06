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
  VISITOR = 'visitor',       // Посетитель (начал взаимодействие, но не подал заявку)
  APPLICANT = 'applicant',   // Заявитель
  MEMBER = 'member',         // Участник
  ADMIN = 'admin'            // Администратор
}

/**
 * Статус пользователя в whitelist сервера
 */
export enum WhitelistStatus {
  ADDED = 'added',           // Успешно добавлен в whitelist
  REMOVED = 'removed',       // Успешно удалён из whitelist
  NOT_ADDED = 'not_added'    // Не добавлен в whitelist
}

/**
 * Интерфейс пользователя
 */
export interface User {
  id: number;                // ID пользователя в БД
  telegramId: number;        // Telegram ID пользователя
  username?: string;         // Имя пользователя в Telegram
  nickname: string;          // Отображаемое имя пользователя
  minecraftNickname: string; // Никнейм в Minecraft
  minecraftUUID?: string;    // UUID игрока в Minecraft
  role: UserRole;            // Роль пользователя
  canVote: boolean;          // Имеет право голосовать
  reputation: number;        // Репутация пользователя
  totalRatingsGiven: number; // Общее количество выданных оценок
  lastRatingGiven?: Date;    // Дата последней выданной оценки
  positiveRatingsReceived?: number; // Количество положительных оценок
  negativeRatingsReceived?: number; // Количество отрицательных оценок
  totalRatingsReceived?: number;   // Общее количество полученных оценок
  whitelistStatus?: WhitelistStatus; // Статус в whitelist сервера
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
 * Интерфейс для создания голоса (без автогенерируемых полей)
 */
export interface CreateVoteRequest {
  applicationId: number;     // ID заявки
  voterId: number;           // ID голосующего 
  voteType: VoteType;        // Тип голоса
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
 * Интерфейс для детальной информации о рейтинге
 */
export interface RatingDetail extends Rating {
  raterNickname: string;     // Никнейм оценившего
  raterUsername?: string;    // Имя пользователя в Telegram
  reason?: string;          // Причина оценки
  cooldownUntil?: Date;     // Дата окончания кулдауна
  createdAt: Date;          // Дата создания оценки
}

/**
 * Интерфейс для истории рейтинга
 */
export interface RatingHistory {
  date: Date;               // Дата изменения
  rating: number;           // Итоговый рейтинг
  change: number;          // Изменение рейтинга
  reason?: string;         // Причина изменения
  raterNickname?: string;  // Никнейм оценившего
}

/**
 * Интерфейс для статистики пользователя
 */
export interface UserStatistics {
  totalRatings: number;     // Общее количество оценок
  positiveCount: number;    // Количество положительных оценок
  negativeCount: number;    // Количество отрицательных оценок
  ratingHistory: RatingHistory[]; // История рейтинга
  lastRatingDate?: Date;    // Дата последней полученной оценки
  ratingsGivenToday: number; // Количество оценок, выданных сегодня
}

/**
 * Интерфейс для расширенного профиля пользователя
 */
export interface UserProfile {
  user_id: number;          // ID пользователя
  nickname: string;         // Отображаемое имя
  minecraft_username?: string; // Никнейм в Minecraft
  join_date: Date;         // Дата вступления
  total_ratings_given: number; // Общее количество выданных оценок
  total_ratings_received: number; // Общее количество полученных оценок
  positive_ratings_received: number; // Количество положительных оценок
  negative_ratings_received: number; // Количество отрицательных оценок
  last_rating_given?: Date; // Дата последней выданной оценки
}

/**
 * Интерфейс для настроек рейтинга
 */
export interface RatingSettings {
  cooldownMinutes: number;      // Время ожидания между оценками одного пользователя
  maxDailyRatings: number;      // Максимальное количество оценок в день
  minReputationForVoting: number; // Минимальная репутация для возможности голосовать
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
  ratingCooldownMinutes: number;   // Время ожидания между оценками одного пользователя
  maxDailyRatings: number;        // Максимальное количество оценок в день
  minReputationForVoting: number;  // Минимальная репутация для возможности голосовать
}