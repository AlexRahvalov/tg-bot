/**
 * Константы для типов оценок
 */
export const RATING_TYPE = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative'
};

/**
 * Шаги процесса оценки
 */
export const RATING_STEPS = {
  AWAITING_REASON: 'awaiting_reason',
  COMPLETED: 'completed'
};

/**
 * Шаги процесса подачи заявки
 */
export const APPLY_STEPS = {
  WAITING_NICKNAME: 'waiting_nickname',
  WAITING_REASON: 'waiting_reason',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  COMPLETED: 'completed'
};

/**
 * Шаги процесса задания вопроса
 */
export const QUESTION_STEPS = {
  WAITING_QUESTION: 'waiting_question',
  WAITING_ANSWER: 'waiting_answer'
};

/**
 * Минимальные значения для разных полей
 */
export const MIN_VALUES = {
  REASON_LENGTH: 10,
  NICKNAME_LENGTH: 3,
  QUESTION_LENGTH: 5,
  ANSWER_LENGTH: 5,
  VOTES_REQUIRED: 3
};

/**
 * Максимальные значения для разных полей
 */
export const MAX_VALUES = {
  REASON_LENGTH: 500,
  NICKNAME_LENGTH: 16,
  QUESTION_LENGTH: 200,
  ANSWER_LENGTH: 500
};

/**
 * Интервалы времени в миллисекундах
 */
export const TIME_INTERVALS = {
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  DEFAULT_VOTING_DURATION: 24 * 60 * 60 * 1000 // 24 часа
};

/**
 * Текстовые метки для кнопок
 */
export const BUTTON_LABELS = {
  SUBMIT_APPLICATION: '📝 Подать заявку',
  CHECK_STATUS: '📊 Статус заявки',
  HELP: 'ℹ️ Помощь',
  SERVER_INFO: '📋 О сервере',
  ADMIN_PANEL: '🛠️ Админ-панель',
  MEMBERS: '👥 Участники',
  ACTIVE_APPLICATIONS: '🗳️ Активные заявки',
  CONFIRM: '✅ Подтвердить',
  CANCEL: '❌ Отменить',
  BACK: '🔙 Назад'
};

/**
 * Предопределенные статусы заявок
 */
export const APPLICATION_STATUSES = {
  PENDING: 'pending',
  VOTING: 'voting',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

/**
 * Предопределенные роли пользователей
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  APPLICANT: 'applicant'
};

/**
 * Эмодзи для разных статусов
 */
export const STATUS_EMOJIS = {
  PENDING: '⏳',
  VOTING: '🗳️',
  APPROVED: '✅',
  REJECTED: '❌',
  EXPIRED: '⏰',
  UNKNOWN: '❓'
}; 