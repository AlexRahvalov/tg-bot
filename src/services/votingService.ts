import { Bot, InlineKeyboard } from 'grammy';
import { ApplicationRepository } from '../db/repositories/applicationRepository';
import { VoteRepository } from '../db/repositories/voteRepository';
import { UserRepository } from '../db/repositories/userRepository';
import { ApplicationStatus, UserRole } from '../models/types';
import type { MyContext } from '../index';
import config from '../config/env';
import { SystemSettingsRepository } from '../db/repositories/systemSettingsRepository';

/**
 * Сервис для управления голосованиями
 */
export class VotingService {
  private applicationRepository: ApplicationRepository;
  private voteRepository: VoteRepository;
  private userRepository: UserRepository;
  private bot: Bot<MyContext>;
  
  /**
   * Инициализация сервиса голосования
   * @param bot Экземпляр бота для отправки уведомлений
   */
  constructor(bot: Bot<MyContext>) {
    this.applicationRepository = new ApplicationRepository();
    this.voteRepository = new VoteRepository();
    this.userRepository = new UserRepository();
    this.bot = bot;
  }
  
  /**
   * Отправка приглашений на голосование всем пользователям с правом голоса
   * @param applicationId ID заявки
   */
  async sendVotingInvitations(applicationId: number): Promise<number> {
    try {
      // Получаем данные о заявке
      const application = await this.applicationRepository.findById(applicationId);
      
      // Если статус не "на голосовании", прерываем выполнение
      if (application.status !== ApplicationStatus.VOTING) {
        console.log(`Заявка ${applicationId} не находится в статусе голосования, отправка приглашений отменена`);
        return 0;
      }
      
      // Получаем всех пользователей с правом голоса
      const voters = await this.userRepository.findVoters();
      
      if (voters.length === 0) {
        console.log('Нет пользователей с правом голоса');
        return 0;
      }
      
      // Получаем данные о заявителе
      const applicant = await this.userRepository.findById(application.userId);
      
      // Создаем клавиатуру с кнопками для голосования
      const keyboard = new InlineKeyboard()
        .text("👍 За", `vote_positive_${applicationId}`)
        .text("👎 Против", `vote_negative_${applicationId}`).row()
        .text("❓ Задать вопрос", `ask_question_${applicationId}`).row()
        .text("🔍 Подробнее", `vote_view_${applicationId}`);
      
      // Формируем текст сообщения
      const votingEndsAt = application.votingEndsAt 
        ? `${application.votingEndsAt.toLocaleDateString()} ${application.votingEndsAt.toLocaleTimeString()}`
        : 'неизвестно';
      
      const message = 
        `🗳️ Новое голосование по заявке!\n\n` +
        `👤 Пользователь: ${applicant?.username || 'Не указан'}\n` +
        `🎮 Никнейм: ${application.minecraftNickname}\n` +
        `📝 Причина: ${application.reason}\n\n` +
        `⏱️ Голосование закончится: ${votingEndsAt}\n\n` +
        `Пожалуйста, проголосуйте, используя кнопки ниже:`;
      
      // Отправляем сообщения всем пользователям с правом голоса
      let sentCount = 0;
      
      for (const voter of voters) {
        try {
          // Пропускаем отправку заявителю
          if (voter.id === application.userId) {
            continue;
          }
          
          await this.bot.api.sendMessage(
            Number(voter.telegramId), 
            message, 
            { reply_markup: keyboard }
          );
          
          sentCount++;
          
          // Добавляем небольшую задержку, чтобы не превысить лимиты API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Ошибка при отправке приглашения на голосование пользователю ${voter.id}:`, error);
        }
      }
      
      console.log(`✅ Отправлено ${sentCount} приглашений на голосование по заявке #${applicationId}`);
      return sentCount;
      
    } catch (error) {
      console.error('Ошибка при отправке приглашений на голосование:', error);
      return 0;
    }
  }
  
  /**
   * Проверка и обработка истекших голосований
   */
  async checkExpiredVotings(): Promise<number> {
    try {
      // Получаем все заявки с истекшим сроком голосования
      const expiredApplications = await this.applicationRepository.findExpiredVotingApplications();
      
      if (expiredApplications.length === 0) {
        return 0;
      }
      
      console.log(`Найдено ${expiredApplications.length} истекших голосований`);
      
      let processedCount = 0;
      
      for (const application of expiredApplications) {
        try {
          await this.processExpiredVoting(application.id);
          processedCount++;
        } catch (error) {
          console.error(`Ошибка при обработке истекшего голосования #${application.id}:`, error);
        }
      }
      
      return processedCount;
      
    } catch (error) {
      console.error('Ошибка при проверке истекших голосований:', error);
      return 0;
    }
  }
  
  /**
   * Обработка истекшего голосования
   * @param applicationId ID заявки
   */
  private async processExpiredVoting(applicationId: number): Promise<void> {
    // Получаем данные о заявке
    const application = await this.applicationRepository.findById(applicationId);
    
    // Если статус не "на голосовании", прерываем выполнение
    if (application.status !== ApplicationStatus.VOTING) {
      console.log(`Заявка ${applicationId} не находится в статусе голосования, обработка отменена`);
      return;
    }
    
    // Получаем актуальное количество голосов
    const votes = await this.voteRepository.countVotes(applicationId);
    
    // Обновляем счетчики голосов в заявке
    await this.applicationRepository.updateVoteCounts(applicationId, votes.positive, votes.negative);
    
    // Получаем данные о заявителе
    const applicant = await this.userRepository.findById(application.userId);
    
    // Получаем системные настройки для проверки минимального количества голосов
    const systemSettingsRepository = new SystemSettingsRepository();
    const settings = await systemSettingsRepository.getSettings();
    
    // Проверяем, достаточно ли голосов
    const totalVotes = votes.positive + votes.negative;
    
    // Если голосов недостаточно, отклоняем заявку
    if (totalVotes < settings.minVotesRequired) {
      await this.applicationRepository.updateStatus(applicationId, ApplicationStatus.REJECTED);
      
      console.log(`❌ Заявка #${applicationId} отклонена из-за недостаточного количества голосов (${totalVotes}/${settings.minVotesRequired})`);
      
      // Отправляем уведомление пользователю
      if (applicant) {
        try {
          await this.bot.api.sendMessage(
            Number(applicant.telegramId),
            `❌ Ваша заявка на вступление в Minecraft-сервер отклонена.\n\n` +
            `Причина: недостаточное количество голосов (${totalVotes}/${settings.minVotesRequired})\n\n` +
            `Вы можете подать новую заявку позже.`
          );
        } catch (error) {
          console.error(`Ошибка при отправке уведомления пользователю ${applicant.id}:`, error);
        }
      }
      
      return;
    }
    
    // Вычисляем процент положительных голосов
    const positivePercentage = (votes.positive / totalVotes) * 100;
    
    // Одобрение/отклонение заявки в зависимости от результатов голосования
    if (positivePercentage >= 60) { // Порог одобрения 60%
      // Одобряем заявку
      await this.applicationRepository.updateStatus(applicationId, ApplicationStatus.APPROVED);
      
      // Обновляем роль пользователя
      if (applicant) {
        await this.userRepository.update(applicant.id, {
          role: UserRole.MEMBER,
          canVote: true // Разрешаем новому участнику голосовать
        });
        
        // Отправляем уведомление пользователю
        try {
          await this.bot.api.sendMessage(
            Number(applicant.telegramId),
            `✅ Поздравляем! Ваша заявка на вступление в Minecraft-сервер одобрена.\n\n` +
            `Результаты голосования:\n` +
            `👍 За: ${votes.positive}\n` +
            `👎 Против: ${votes.negative}\n\n` +
            `Теперь вы можете подключиться к серверу, используя свой никнейм: ${application.minecraftNickname}\n\n` +
            `Приятной игры!`
          );
        } catch (error) {
          console.error(`Ошибка при отправке уведомления пользователю ${applicant.id}:`, error);
        }
      }
      
      console.log(`✅ Заявка #${applicationId} одобрена (${votes.positive}/${totalVotes} голосов за)`);
      
    } else {
      // Отклоняем заявку
      await this.applicationRepository.updateStatus(applicationId, ApplicationStatus.REJECTED);
      
      // Отправляем уведомление пользователю
      if (applicant) {
        try {
          await this.bot.api.sendMessage(
            Number(applicant.telegramId),
            `❌ К сожалению, ваша заявка на вступление в Minecraft-сервер отклонена.\n\n` +
            `Результаты голосования:\n` +
            `👍 За: ${votes.positive}\n` +
            `👎 Против: ${votes.negative}\n\n` +
            `Вы можете подать новую заявку позже.`
          );
        } catch (error) {
          console.error(`Ошибка при отправке уведомления пользователю ${applicant.id}:`, error);
        }
      }
      
      console.log(`❌ Заявка #${applicationId} отклонена (${votes.negative}/${totalVotes} голосов против)`);
    }
  }
} 