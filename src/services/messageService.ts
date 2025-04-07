import { ApplicationStatus } from "../models/types";
import type { MyContext } from "../index";
import type { Application } from "../models/types";
import { logger } from "../utils/logger";
import { pluralize } from '../utils/stringUtils';

/**
 * Сервис для работы с сообщениями в боте
 */
class MessageService {
  /**
   * Отправляет сообщение со статусом заявки
   * @param ctx Контекст сообщения
   * @param application Заявка
   */
  async sendApplicationStatus(ctx: MyContext, application: Application): Promise<void> {
    if (!application) {
      await ctx.reply('⚠️ Информация о заявке не найдена.');
      return;
    }
    
    let statusText = '';
    switch (application.status) {
      case ApplicationStatus.PENDING:
        statusText = '⏳ На рассмотрении';
        break;
      case ApplicationStatus.VOTING:
        statusText = '🗳️ Идет голосование';
        break;
      case ApplicationStatus.APPROVED:
        statusText = '✅ Одобрена';
        break;
      case ApplicationStatus.REJECTED:
        statusText = '❌ Отклонена';
        break;
      default:
        statusText = '❓ Неизвестный статус';
    }
    
    // Добавляем информацию о голосовании, если оно идет
    let votingInfo = '';
    if (application.status === ApplicationStatus.VOTING && application.votingEndsAt) {
      const now = new Date();
      const endDate = new Date(application.votingEndsAt);
      const remainingTime = Math.max(0, endDate.getTime() - now.getTime());
      const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
      
      votingInfo = `\n\n📊 Информация о голосовании:\n` +
        `👍 За: ${application.positiveVotes || 0}\n` +
        `👎 Против: ${application.negativeVotes || 0}\n` +
        `⏱️ Осталось: ${remainingHours} ч ${remainingMinutes} мин`;
    }
    
    await ctx.reply(
      `📋 Статус вашей заявки: ${statusText}\n\n` +
      `📅 Дата создания: ${application.createdAt.toLocaleDateString()}\n` +
      `🎮 Никнейм: ${application.minecraftNickname}\n` +
      `📝 Причина: ${application.reason}${votingInfo}\n\n` +
      'Мы уведомим вас, когда статус вашей заявки изменится.'
    );
  }

  /**
   * Форматирует сообщение с информацией о заявке для администраторов
   * @param application Заявка
   * @param applicantName Имя заявителя
   * @returns Форматированное сообщение
   */
  formatApplicationInfoForAdmin(application: Application, applicantName: string): string {
    let statusText = '';
    switch (application.status) {
      case ApplicationStatus.PENDING:
        statusText = '⏳ На рассмотрении';
        break;
      case ApplicationStatus.VOTING:
        statusText = '🗳️ Идет голосование';
        break;
      case ApplicationStatus.APPROVED:
        statusText = '✅ Одобрена';
        break;
      case ApplicationStatus.REJECTED:
        statusText = '❌ Отклонена';
        break;
      default:
        statusText = '❓ Неизвестный статус';
    }
    
    // Добавляем информацию о голосовании, если оно идет
    let votingInfo = '';
    if (application.status === ApplicationStatus.VOTING && application.votingEndsAt) {
      const now = new Date();
      const endDate = new Date(application.votingEndsAt);
      const remainingTime = Math.max(0, endDate.getTime() - now.getTime());
      const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
      
      votingInfo = `\n\n📊 Информация о голосовании:\n` +
        `👍 За: ${application.positiveVotes || 0}\n` +
        `👎 Против: ${application.negativeVotes || 0}\n` +
        `⏱️ Осталось: ${remainingHours} ч ${remainingMinutes} мин`;
    }
    
    return `📋 Заявка #${application.id}\n\n` +
      `👤 Пользователь: ${applicantName}\n` +
      `🎮 Никнейм: ${application.minecraftNickname}\n` +
      `📝 Причина: ${application.reason}\n` +
      `📅 Создана: ${application.createdAt.toLocaleDateString()} ${application.createdAt.toLocaleTimeString()}\n` +
      `🔄 Статус: ${statusText}${votingInfo}`;
  }

  /**
   * Форматирует сообщение с результатами голосования
   * @param applicationId ID заявки
   * @param positiveVotes Количество положительных голосов
   * @param negativeVotes Количество отрицательных голосов
   * @param isPositive Голосовал ли пользователь положительно
   * @returns Форматированное сообщение
   */
  formatVotingResultsMessage(
    applicationId: number, 
    positiveVotes: number, 
    negativeVotes: number, 
    isPositive: boolean
  ): string {
    return `📋 Вы проголосовали ${isPositive ? 'ЗА' : 'ПРОТИВ'} заявку #${applicationId}!\n\n` +
      `Текущие результаты:\n` +
      `👍 За: ${positiveVotes}\n` +
      `👎 Против: ${negativeVotes}\n\n` +
      `Спасибо за участие в голосовании!`;
  }

  /**
   * Форматирует сообщение для уведомления о положительном голосе за пользователя
   * @param votedUsername Имя пользователя, за которого проголосовали
   * @param voterUsername Имя пользователя, который проголосовал
   * @param newReputation Новое значение репутации
   * @returns Форматированное сообщение
   */
  formatPositiveRatingNotification(
    votedUsername: string,
    voterUsername: string,
    newReputation: number
  ): string {
    return `👍 Участник ${voterUsername} оценил вас положительно!\n\n` +
      `Ваша текущая репутация: ${newReputation}\n\n` +
      `Спасибо за активное участие в жизни сервера!`;
  }

  /**
   * Форматирует сообщение для уведомления о негативном голосе за пользователя
   * @param votedUsername Имя пользователя, за которого проголосовали
   * @param voterUsername Имя пользователя, который проголосовал
   * @param reason Причина негативной оценки
   * @param newReputation Новое значение репутации
   * @param thresholdWarning Предупреждение о приближении к пороговому значению
   * @returns Форматированное сообщение
   */
  formatNegativeRatingNotification(
    votedUsername: string,
    voterUsername: string,
    reason: string,
    newReputation: number,
    thresholdWarning: boolean
  ): string {
    let message = `👎 Участник ${voterUsername} оценил вас негативно.\n\n` +
      `Причина: ${reason}\n\n` +
      `Ваша текущая репутация: ${newReputation}\n\n`;
    
    if (thresholdWarning) {
      message += `⚠️ Внимание! Ваша репутация приближается к критическому значению. ` +
        `При достижении порогового значения будет рассмотрен вопрос о вашем исключении из сообщества.`;
    } else {
      message += `Пожалуйста, обратите внимание на причину негативной оценки и постарайтесь исправить ситуацию.`;
    }
    
    return message;
  }

  /**
   * Форматирует текст для стартового сообщения бота
   * @returns Форматированное сообщение
   */
  getStartMessage(): string {
    return 'Привет! Я бот для доступа к Minecraft-серверу. С моей помощью вы можете подать заявку на вступление.\n\n' +
      'Используйте кнопки ниже или команду /apply для начала процесса подачи заявки.';
  }

  /**
   * Форматирует текст для сообщения с помощью
   * @returns Форматированное сообщение
   */
  getHelpMessage(): string {
    return 'Я помогаю управлять доступом к Minecraft-серверу.\n\n' +
      'Доступные команды:\n' +
      '/start - Начать работу с ботом\n' +
      '/apply - Подать заявку на вступление\n' +
      '/status - Проверить статус заявки\n' +
      '/help - Показать справку\n' +
      '/members - Просмотр участников (для членов сервера)\n\n' +
      'Для администраторов:\n' +
      '/admin - Панель администратора';
  }

  /**
   * Форматирует текст для сообщения с информацией о сервере
   * @returns Форматированное сообщение
   */
  getServerInfoMessage(): string {
    return 'Информация о нашем Minecraft-сервере:\n\n' +
      '🏠 IP-адрес: play.example.com\n' +
      '🎮 Версия: 1.20.2\n' +
      '👥 Режим игры: Выживание\n' +
      '👮 Тип доступа: Демократический белый список\n\n' +
      'Чтобы подать заявку на вступление, используйте команду /apply или кнопку "Подать заявку".';
  }

  /**
   * Форматирование сообщения о заявке
   * @param application Объект заявки
   * @param username Имя пользователя
   * @param questionCount Количество вопросов к заявке
   */
  formatApplicationMessage(
    application: Application, 
    username?: string, 
    questionCount = 0
  ): string {
    const statusMap = {
      'pending': '⏳ Ожидает рассмотрения',
      'voting': '🗳️ На голосовании',
      'approved': '✅ Одобрена',
      'rejected': '❌ Отклонена',
      'expired': '⏰ Истек срок голосования'
    };
    
    const status = statusMap[application.status] || '❓ Неизвестный статус';
    const votes = `👍 ${application.positiveVotes} | 👎 ${application.negativeVotes}`;
    const timeAgo = this.getTimeAgo(application.createdAt);
    
    let message = `
📝 *Заявка #${application.id}*

👤 *Игрок:* ${application.minecraftNickname}
${username ? `*Телеграм:* @${username}\n` : ''}
*Причина вступления:*
_${application.reason}_

*Статус:* ${status}
*Голоса:* ${votes}
*Создана:* ${timeAgo}`;
    
    if (application.votingEndsAt && application.status === 'voting') {
      const timeLeft = this.getTimeLeft(application.votingEndsAt);
      message += `\n*До окончания голосования:* ${timeLeft}`;
    }
    
    if (questionCount > 0) {
      message += `\n\n❓ *Вопросов:* ${questionCount}`;
    }
    
    return message;
  }
  
  /**
   * Форматирование временного интервала в виде "сколько времени прошло"
   * @param date Дата для расчета
   */
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'только что';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${pluralize(diffInMinutes, 'минуту', 'минуты', 'минут')} назад`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ${pluralize(diffInHours, 'час', 'часа', 'часов')} назад`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${pluralize(diffInDays, 'день', 'дня', 'дней')} назад`;
    }
    
    return date.toLocaleDateString('ru-RU');
  }
  
  /**
   * Форматирование оставшегося времени
   * @param date Дата для расчета 
   */
  getTimeLeft(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
    
    if (diffInSeconds <= 0) {
      return 'истекло';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${pluralize(diffInMinutes, 'минута', 'минуты', 'минут')}`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      const remainingMinutes = diffInMinutes % 60;
      return `${diffInHours} ${pluralize(diffInHours, 'час', 'часа', 'часов')} ${remainingMinutes} ${pluralize(remainingMinutes, 'минута', 'минуты', 'минут')}`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    const remainingHours = diffInHours % 24;
    return `${diffInDays} ${pluralize(diffInDays, 'день', 'дня', 'дней')} ${remainingHours} ${pluralize(remainingHours, 'час', 'часа', 'часов')}`;
  }
  
  /**
   * Форматирование длительности 
   * @param days Дни
   * @param hours Часы
   * @param minutes Минуты
   */
  formatDuration(days: number, hours: number, minutes: number): string {
    let result = '';
    if (days > 0) {
      result += `${days} ${pluralize(days, 'день', 'дня', 'дней')} `;
    }
    if (hours > 0 || days > 0) {
      result += `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} `;
    }
    result += `${minutes} ${pluralize(minutes, 'минута', 'минуты', 'минут')}`;
    return result;
  }
}

// Создаем и экспортируем инстанс сервиса
export const messageService = new MessageService(); 