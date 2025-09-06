import { ApplicationStatus, type Application, type User } from '../models/types';
import { escapeMarkdown } from './stringUtils';

/**
 * Утилиты для форматирования сообщений
 */
export class MessageUtils {
  /**
   * Форматирует информацию о заявке для отображения
   * @param application Заявка
   * @param applicant Заявитель (опционально)
   * @param includeVoting Включить информацию о голосовании
   * @returns Форматированное сообщение
   */
  static formatApplicationInfo(
    application: Application, 
    applicant?: User | null, 
    includeVoting: boolean = false
  ): string {
    const statusMap = {
      [ApplicationStatus.PENDING]: '⏳ Ожидает рассмотрения',
      [ApplicationStatus.VOTING]: '🗳️ На голосовании',
      [ApplicationStatus.APPROVED]: '✅ Одобрена',
      [ApplicationStatus.REJECTED]: '❌ Отклонена',
      [ApplicationStatus.EXPIRED]: '⏰ Истек срок голосования'
    };

    const status = statusMap[application.status] || '❓ Неизвестный статус';
    const createdAt = application.createdAt.toLocaleDateString('ru-RU');
    
    let message = `📝 *Заявка #${application.id}*\n\n`;
    message += `👤 *Игрок:* ${escapeMarkdown(application.minecraftNickname)}\n`;
    
    if (applicant?.username) {
      message += `*Телеграм:* @${escapeMarkdown(applicant.username)}\n`;
    }
    
    message += `*Причина вступления:*\n_${escapeMarkdown(application.reason)}_\n\n`;
    message += `*Статус:* ${status}\n`;
    message += `*Создана:* ${createdAt}`;

    if (includeVoting && application.status === ApplicationStatus.VOTING) {
      const votes = `👍 ${application.positiveVotes || 0} | 👎 ${application.negativeVotes || 0}`;
      message += `\n*Голоса:* ${votes}`;
      
      if (application.votingEndsAt) {
        const timeLeft = this.getTimeLeft(application.votingEndsAt);
        message += `\n*До окончания голосования:* ${timeLeft}`;
      }
    }

    return message;
  }

  /**
   * Форматирует краткую информацию о заявке для списка
   * @param application Заявка
   * @param applicant Заявитель (опционально)
   * @returns Краткое описание заявки
   */
  static formatApplicationSummary(application: Application, applicant?: User | null): string {
    const applicantName = applicant?.username 
      ? `@${escapeMarkdown(applicant.username)}` 
      : 'Не указан';
    
    const reason = application.reason.length > 100 
      ? `${escapeMarkdown(application.reason.substring(0, 100))}...` 
      : escapeMarkdown(application.reason);

    return `*Заявка #${application.id}* - ${escapeMarkdown(application.minecraftNickname)} (${applicantName})\n` +
           `*Причина:* ${reason}`;
  }

  /**
   * Форматирует информацию о пользователе для профиля
   * @param user Пользователь
   * @param includeReputation Включить информацию о репутации
   * @param includeStats Включить статистику рейтингов
   * @returns Форматированная информация о пользователе
   */
  static formatUserProfile(
    user: User, 
    includeReputation: boolean = true, 
    includeStats: boolean = false
  ): string {
    let message = `👤 *Профиль пользователя*\n\n`;
    
    if (user.username) {
      message += `*Телеграм:* @${escapeMarkdown(user.username)}\n`;
    }
    
    if (user.minecraftNickname) {
      message += `*Minecraft:* ${escapeMarkdown(user.minecraftNickname)}\n`;
    }
    
    message += `*Дата регистрации:* ${user.createdAt.toLocaleDateString('ru-RU')}\n`;
    
    if (includeReputation) {
      const reputationIcon = user.reputation > 0 ? '👍' : user.reputation < 0 ? '👎' : '➖';
      message += `*Репутация:* ${reputationIcon} ${user.reputation}\n`;
    }
    
    if (includeStats) {
      message += `*Положительных оценок получено:* ${user.positiveRatingsReceived || 0}\n`;
      message += `*Отрицательных оценок получено:* ${user.negativeRatingsReceived || 0}\n`;
      message += `*Всего оценок дано:* ${user.totalRatingsGiven || 0}\n`;
    }
    
    message += `*Право голоса:* ${user.canVote ? '✅' : '❌'}`;

    return message;
  }

  /**
   * Форматирует уведомление о рейтинге
   * @param isPositive Положительный ли рейтинг
   * @param voterName Имя голосующего
   * @param targetName Имя цели
   * @param newReputation Новая репутация
   * @param reason Причина (для отрицательного рейтинга)
   * @param thresholdWarning Предупреждение о пороге
   * @returns Форматированное уведомление
   */
  static formatRatingNotification(
    isPositive: boolean,
    voterName: string,
    targetName: string,
    newReputation: number,
    reason?: string,
    thresholdWarning: boolean = false
  ): string {
    let message = isPositive 
      ? `👍 *Положительная оценка*\n\n`
      : `👎 *Отрицательная оценка*\n\n`;
    
    message += `Пользователь @${escapeMarkdown(voterName)} оценил вас ${isPositive ? 'положительно' : 'отрицательно'}.\n`;
    
    if (!isPositive && reason) {
      message += `*Причина:* ${escapeMarkdown(reason)}\n`;
    }
    
    message += `\n*Ваша новая репутация:* ${newReputation}`;
    
    if (thresholdWarning) {
      message += `\n\n⚠️ *Внимание!* Ваша репутация приближается к критическому уровню.`;
    }

    return message;
  }

  /**
   * Форматирует результаты голосования
   * @param applicationId ID заявки
   * @param positiveVotes Положительные голоса
   * @param negativeVotes Отрицательные голоса
   * @param isApproved Одобрена ли заявка
   * @returns Форматированные результаты
   */
  static formatVotingResults(
    applicationId: number,
    positiveVotes: number,
    negativeVotes: number,
    isApproved: boolean
  ): string {
    const result = isApproved ? '✅ одобрена' : '❌ отклонена';
    
    return `🗳️ *Результаты голосования*\n\n` +
           `Заявка #${applicationId} ${result}.\n\n` +
           `👍 За: ${positiveVotes}\n` +
           `👎 Против: ${negativeVotes}`;
  }

  /**
   * Получает оставшееся время до даты
   * @param date Целевая дата
   * @returns Строка с оставшимся временем
   */
  private static getTimeLeft(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Время истекло';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} дн. ${hours} ч.`;
    } else if (hours > 0) {
      return `${hours} ч. ${minutes} мин.`;
    } else {
      return `${minutes} мин.`;
    }
  }

  /**
   * Форматирует время, прошедшее с даты
   * @param date Дата
   * @returns Строка с прошедшим временем
   */
  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} дн. назад`;
    } else if (hours > 0) {
      return `${hours} ч. назад`;
    } else if (minutes > 0) {
      return `${minutes} мин. назад`;
    } else {
      return 'только что';
    }
  }

  /**
   * Создает стандартные сообщения бота
   */
  static getStandardMessages() {
    return {
      start: `👋 Добро пожаловать в бот управления сервером Minecraft!\n\n` +
             `Этот бот поможет вам подать заявку на вступление в наше сообщество. ` +
             `Используйте кнопки ниже для навигации.`,
      
      help: `ℹ️ *Справка по боту*\n\n` +
            `*Основные команды:*\n` +
            `/start - Главное меню\n` +
            `/help - Эта справка\n` +
            `/profile - Ваш профиль\n\n` +
            `*Для участников:*\n` +
            `/members - Список участников\n` +
            `/applications - Активные заявки\n\n` +
            `*Для администраторов:*\n` +
            `/admin - Панель администратора`,
      
      serverInfo: `🎮 *Информация о сервере*\n\n` +
                  `Наш сервер - это дружное сообщество игроков Minecraft. ` +
                  `Мы ценим взаимопомощь, креативность и честную игру.\n\n` +
                  `Для получения доступа необходимо подать заявку и пройти голосование участников сообщества.`,
      
      noAccess: '⚠️ У вас нет доступа к этой функции.',
      userNotFound: '⚠️ Не удалось определить пользователя.',
      alreadyMember: '⚠️ Вы уже являетесь участником сервера.',
      hasActiveApplication: '⚠️ У вас уже есть активная заявка.',
      noActiveApplication: '⚠️ У вас нет активных заявок.'
    };
  }
}