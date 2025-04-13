import { Bot } from 'grammy';
import { User, UserModel, UserRole } from '../models/user.model';
import { ReputationReasonModel, ReputationReason } from '../models/reputation/reputation.reason.model';
import { ReputationRecordModel, ReputationRecord } from '../models/reputation/reputation.record.model';
import { MinecraftService } from './minecraft.service';
import { NotificationService } from './notification.service';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

/**
 * Интерфейс с результатами проверки репутации
 */
interface ReputationCheckResult {
  shouldBeRemoved: boolean;
  negativePercent: number;
  threshold: number;
  totalVoters: number;
}

/**
 * Сервис для работы с репутацией пользователей
 */
export class ReputationService {
  private minecraftService: MinecraftService;
  private notificationService?: NotificationService;
  private negativeThresholdPercent: number;
  private amnestyPeriodMonths: number;
  private amnestyReductionPercent: number;

  constructor(notificationService?: NotificationService) {
    this.minecraftService = new MinecraftService();
    this.notificationService = notificationService;
    
    // Загрузка настроек из переменных окружения
    this.negativeThresholdPercent = Number(process.env.NEGATIVE_THRESHOLD_PERCENT) || 30;
    this.amnestyPeriodMonths = Number(process.env.AMNESTY_PERIOD_MONTHS) || 3;
    this.amnestyReductionPercent = Number(process.env.AMNESTY_REDUCTION_PERCENT) || 30;
    
    console.log(`Инициализация ReputationService:
    - Порог негативных оценок: ${this.negativeThresholdPercent}%
    - Период амнистии: ${this.amnestyPeriodMonths} мес.
    - Процент сброса негативных оценок: ${this.amnestyReductionPercent}%`);
  }

  /**
   * Голосование за пользователя
   * @param voterTelegramId - Telegram ID голосующего
   * @param targetTelegramId - Telegram ID пользователя, за которого голосуют
   * @param isPositive - Положительная или отрицательная оценка
   * @param reasonId - ID причины голосования
   * @returns true, если голосование успешно
   */
  async voteForUser(
    voterTelegramId: number, 
    targetTelegramId: number, 
    isPositive: boolean,
    reasonId?: number
  ): Promise<boolean> {
    try {
      // Получаем данные пользователей
      const voter = await UserModel.getByTelegramId(voterTelegramId);
      const target = await UserModel.getByTelegramId(targetTelegramId);
      
      if (!voter || !target || !voter.id || !target.id) {
        console.error('Пользователь не найден:', !voter ? voterTelegramId : targetTelegramId);
        return false;
      }
      
      // Проверяем, имеет ли пользователь право голоса
      if (!voter.canVote) {
        console.error('Пользователь не имеет права голоса:', voterTelegramId);
        return false;
      }
      
      // Проверяем, не пытается ли пользователь голосовать за себя
      if (voter.id === target.id) {
        console.error('Пользователь пытается голосовать за себя:', voterTelegramId);
        return false;
      }
      
      // Проверяем, можно ли голосовать за данного пользователя
      if (target.role !== UserRole.MEMBER && target.role !== UserRole.ADMIN) {
        console.error('Нельзя голосовать за пользователя с ролью:', target.role);
        return false;
      }
      
      // Проверяем, голосовал ли пользователь уже за данного пользователя
      const hasVoted = await ReputationRecordModel.hasUserVoted(voter.id, target.id);
      if (hasVoted) {
        console.error('Пользователь уже голосовал за данного пользователя:', voterTelegramId);
        return false;
      }
      
      // Для отрицательной оценки проверяем наличие причины
      if (!isPositive && !reasonId) {
        console.error('Для отрицательной оценки необходимо указать причину');
        return false;
      }
      
      // Определяем вес голоса
      let voteWeight = 1.0;
      
      // Администраторы имеют больший вес
      if (voter.role === UserRole.ADMIN) {
        voteWeight = 1.5;
      } 
      // Пользователи с положительной репутацией имеют повышенный вес
      else if (voter.reputation_positive && voter.reputation_negative && 
               voter.reputation_positive > voter.reputation_negative) {
        const positiveRatio = voter.reputation_positive / 
          (voter.reputation_positive + voter.reputation_negative || 1);
        voteWeight = 1.0 + (positiveRatio * 0.5);
      } 
      // Новые пользователи и гости имеют пониженный вес
      else if (voter.role !== UserRole.MEMBER) {
        voteWeight = 0.7;
      }
      
      // Создаем запись о голосовании
      await ReputationRecordModel.create({
        voter_id: voter.id,
        target_id: target.id,
        is_positive: isPositive,
        reason_id: reasonId,
        vote_weight: voteWeight
      });
      
      // Обновляем репутацию пользователя
      await ReputationRecordModel.updateUserReputation(target.id);
      
      // Проверяем, не нужно ли исключить пользователя
      if (!isPositive) {
        await this.checkAndProcessUserForExclusion(target.id);
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка при голосовании за пользователя:', error);
      return false;
    }
  }

  /**
   * Проверка репутации пользователя на предмет исключения
   * @param userId - ID пользователя
   * @returns Результат проверки
   */
  async checkUserForExclusion(userId: number): Promise<ReputationCheckResult> {
    try {
      // Получаем данные пользователя
      const user = await UserModel.getById(userId);
      if (!user) {
        console.error('Пользователь не найден:', userId);
        return {
          shouldBeRemoved: false,
          negativePercent: 0,
          threshold: this.negativeThresholdPercent,
          totalVoters: 0
        };
      }
      
      // Пропускаем проверку для администраторов
      if (user.role === UserRole.ADMIN) {
        return {
          shouldBeRemoved: false,
          negativePercent: 0,
          threshold: this.negativeThresholdPercent,
          totalVoters: 0
        };
      }
      
      // Получаем количество пользователей с правом голоса
      const voters = await UserModel.getVoters();
      const totalVoters = voters.length;
      
      // Если меньше 3 пользователей с правом голоса, не исключаем
      if (totalVoters < 3) {
        return {
          shouldBeRemoved: false,
          negativePercent: 0,
          threshold: this.negativeThresholdPercent,
          totalVoters
        };
      }
      
      // Расчет процента негативных оценок от общего числа пользователей с правом голоса
      const negativePercent = totalVoters > 0 && user.reputation_negative ? 
        (user.reputation_negative / totalVoters) * 100 : 0;
      
      // Проверка, превышен ли порог отрицательных оценок
      const shouldBeRemoved = negativePercent >= this.negativeThresholdPercent;
      
      return {
        shouldBeRemoved,
        negativePercent,
        threshold: this.negativeThresholdPercent,
        totalVoters
      };
    } catch (error) {
      console.error('Ошибка при проверке репутации пользователя:', error);
      return {
        shouldBeRemoved: false,
        negativePercent: 0,
        threshold: this.negativeThresholdPercent,
        totalVoters: 0
      };
    }
  }

  /**
   * Проверка и обработка исключения пользователя на основе репутации
   * @param userId - ID пользователя
   * @returns true, если пользователь был исключен
   */
  async checkAndProcessUserForExclusion(userId: number): Promise<boolean> {
    try {
      const checkResult = await this.checkUserForExclusion(userId);
      
      if (checkResult.shouldBeRemoved) {
        // Получаем данные пользователя
        const user = await UserModel.getById(userId);
        if (!user || !user.minecraftUsername) return false;
        
        // Удаляем из белого списка
        await this.minecraftService.removeFromWhitelist(user.minecraftUsername);
        
        // Меняем роль пользователя на GUEST
        await UserModel.updateRole(userId, UserRole.GUEST);
        
        // Отключаем право голоса
        await UserModel.updateVotePermission(userId, false);
        
        // Уведомляем администраторов
        if (this.notificationService) {
          const admins = await UserModel.getAdmins();
          
          // Формируем текст уведомления
          const message = `⚠️ *Автоматическое исключение из белого списка*\n\n`
            + `Пользователь ${user.firstName} ${user.lastName || ''} (@${user.username || 'нет юзернейма'}) `
            + `был автоматически исключен из белого списка сервера из-за негативных оценок.\n\n`
            + `📊 *Статистика*:\n`
            + `- Негативные оценки: ${Math.round((user.reputation_negative || 0) * 10) / 10} (${Math.round(checkResult.negativePercent)}%)\n`
            + `- Порог исключения: ${checkResult.threshold}%\n`
            + `- Всего голосующих: ${checkResult.totalVoters}`;
          
          // Отправляем сообщение всем администраторам
          for (const admin of admins) {
            await this.notificationService.sendMessage(
              admin.telegramId,
              message
            );
          }
          
          // Уведомляем пользователя
          await this.notificationService.sendMessage(
            user.telegramId,
            `⚠️ *Вы были исключены из белого списка сервера*\n\n`
            + `К сожалению, вы были автоматически исключены из белого списка Minecraft-сервера `
            + `из-за высокого количества негативных оценок от других участников сообщества.\n\n`
            + `Ваша негативная репутация (${Math.round(checkResult.negativePercent)}%) превысила установленный порог (${checkResult.threshold}%).\n\n`
            + `Если вы считаете, что это ошибка, вы можете обратиться к администраторам сервера.`
          );
        }
        
        console.log(`Пользователь ${user.firstName} (ID: ${userId}) был исключен из-за негативной репутации (${Math.round(checkResult.negativePercent)}%)`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка при обработке исключения пользователя:', error);
      return false;
    }
  }

  /**
   * Выполнение амнистии - частичный сброс негативных оценок для всех пользователей
   * @returns Количество пользователей, для которых была выполнена амнистия
   */
  async performAmnesty(): Promise<number> {
    try {
      console.log('Выполнение амнистии репутации...');
      
      // Получаем всех пользователей
      const users = await UserModel.getAllUsers();
      let amnestyCount = 0;
      
      for (const user of users) {
        // Если у пользователя есть негативные оценки
        if (user.reputation_negative && user.reputation_negative > 0) {
          // Расчет суммы для сброса
          const reductionAmount = user.reputation_negative * (this.amnestyReductionPercent / 100);
          const newNegativeValue = Math.max(0, user.reputation_negative - reductionAmount);
          
          // Обновляем поля репутации
          await UserModel.update(user.id as number, {
            reputation_negative: newNegativeValue,
            reputation_last_reset: new Date()
          });
          
          console.log(`Амнистия для пользователя ${user.firstName} (ID: ${user.id}): снижение негативных оценок с ${user.reputation_negative} на ${newNegativeValue}`);
          amnestyCount++;
        }
      }
      
      console.log(`Амнистия репутации завершена. Обработано пользователей: ${amnestyCount}`);
      return amnestyCount;
    } catch (error) {
      console.error('Ошибка при выполнении амнистии репутации:', error);
      return 0;
    }
  }

  /**
   * Получение всех причин репутации
   * @param isPositive - Фильтр по типу (положительные/отрицательные)
   * @returns Массив причин репутации
   */
  async getReputationReasons(isPositive?: boolean): Promise<ReputationReason[]> {
    return ReputationReasonModel.getAll(isPositive);
  }

  /**
   * Получение статистики репутации пользователя
   * @param telegramId - Telegram ID пользователя
   * @returns Объект с данными о репутации или null при ошибке
   */
  async getUserReputationStats(telegramId: number): Promise<{
    positive: number,
    negative: number,
    negativePercent: number,
    threshold: number,
    records: ReputationRecord[]
  } | null> {
    try {
      const user = await UserModel.getByTelegramId(telegramId);
      if (!user || !user.id) return null;
      
      // Получаем все записи о репутации
      const records = await ReputationRecordModel.getByUserId(user.id);
      
      // Получаем количество пользователей с правом голоса
      const totalVoters = await UserModel.getVotersCount();
      
      // Расчет процента негативных оценок
      const negativePercent = totalVoters > 0 && user.reputation_negative ? 
        (user.reputation_negative / totalVoters) * 100 : 0;
      
      return {
        positive: user.reputation_positive || 0,
        negative: user.reputation_negative || 0,
        negativePercent,
        threshold: this.negativeThresholdPercent,
        records
      };
    } catch (error) {
      console.error('Ошибка при получении статистики репутации пользователя:', error);
      return null;
    }
  }

  /**
   * Получение расширенной статистики репутации пользователя
   * @param telegramId - Telegram ID пользователя
   * @returns Объект с данными о репутации и подробной информацией о записях
   */
  async getUserDetailedReputationStats(telegramId: number): Promise<any | null> {
    try {
      const user = await UserModel.getByTelegramId(telegramId);
      if (!user || !user.id) return null;
      
      // Получаем подробные данные о репутации
      const basicStats = await this.getUserReputationStats(telegramId);
      if (!basicStats) return null;
      
      // Получаем расширенные записи о репутации
      const detailedRecords = await ReputationRecordModel.getDetailedByUserId(user.id);
      
      // Группировка по причинам для негативных оценок
      const negativeReasonStats: {[key: string]: number} = {};
      
      for (const record of detailedRecords) {
        if (!record.is_positive && record.reason) {
          const reasonName = record.reason.name;
          negativeReasonStats[reasonName] = (negativeReasonStats[reasonName] || 0) + record.vote_weight;
        }
      }
      
      return {
        ...basicStats,
        detailedRecords,
        negativeReasonStats,
        lastAmnestyDate: user.reputation_last_reset
      };
    } catch (error) {
      console.error('Ошибка при получении детальной статистики репутации пользователя:', error);
      return null;
    }
  }
} 