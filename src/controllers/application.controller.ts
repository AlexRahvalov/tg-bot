import { Context, SessionFlavor, InlineKeyboard } from 'grammy';
import { ApplicationService } from '../services/application.service';
import { NotificationService } from '../services/notification.service';
import { UserModel, UserRole } from '../models/user.model';
import { ApplicationStatus, Application } from '../models/application.model';
import { KeyboardService } from '../services/keyboard.service';
import { RoleController } from './role.controller';

// Определение типа для сессии
interface SessionData {
  applyStep?: number;
  minecraftUsername?: string;
  applicationReason?: string;
}

// Расширенный тип контекста с сессией
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * Контроллер для обработки заявок на вступление
 */
export class ApplicationController {
  private applicationService: ApplicationService;
  private notificationService: NotificationService;
  private keyboardService: KeyboardService;
  private roleController: RoleController;

  constructor(bot: any, applicationService?: ApplicationService, notificationService?: NotificationService) {
    this.applicationService = applicationService || new ApplicationService();
    this.notificationService = notificationService || new NotificationService(bot);
    this.keyboardService = new KeyboardService(bot);
    this.roleController = new RoleController(bot);
  }

  /**
   * Обработчик команды /apply для начала процесса подачи заявки
   * @param ctx - Контекст Telegram
   */
  async startApply(ctx: MyContext): Promise<void> {
    try {
      // Проверяем, существует ли пользователь или создаем нового с ролью NEW
      const user = await this.roleController.setNewUserRole(ctx);
      
      if (!user) {
        await ctx.reply('Произошла ошибка при регистрации пользователя. Пожалуйста, попробуйте позже.');
        return;
      }

      // Проверяем, имеет ли пользователь другую роль, кроме NEW
      if (user.role !== UserRole.NEW) {
        if (user.role === UserRole.GUEST) {
          await ctx.reply('У вас уже есть активная заявка на рассмотрении.', {
            reply_markup: new InlineKeyboard()
              .text("Проверить статус", "status")
              .row()
              .text("На главную", "start")
          });
        } else {
          await ctx.reply('Вы уже являетесь участником сообщества и не можете подать новую заявку.', {
            reply_markup: new InlineKeyboard()
              .text("На главную", "start")
          });
        }
        return;
      }
      
      // Проверяем активные заявки пользователя
      const activeApplication = await this.getLastApplication(ctx.from!.id);
      if (activeApplication && activeApplication.status === ApplicationStatus.PENDING) {
        await ctx.reply('У вас уже есть активная заявка на рассмотрении.', {
          reply_markup: new InlineKeyboard()
            .text("Проверить статус", "status")
            .row()
            .text("На главную", "start")
        });
        return;
      }
      
      // Запускаем процесс заполнения заявки
      ctx.session.applyStep = 1;
      await ctx.reply('Для подачи заявки на вступление в сервер, пожалуйста, укажите ваш ник в Minecraft:', {
        reply_markup: new InlineKeyboard().text("Отменить", "cancel_apply")
      });
    } catch (error) {
      console.error('Ошибка при начале процесса подачи заявки:', error);
      await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
    }
  }

  /**
   * Обработчик шагов заполнения заявки
   * @param ctx - Контекст Telegram
   */
  async processApplyStep(ctx: MyContext): Promise<void> {
    try {
      // Проверяем, что пользователь находится в процессе заполнения заявки
      if (!ctx.session.applyStep) {
        return;
      }

      // Обрабатываем текущий шаг
      switch (ctx.session.applyStep) {
        case 1: // Ввод ника в Minecraft
          if (ctx.message && 'text' in ctx.message) {
            const minecraftUsername = ctx.message.text?.trim() || '';
            
            // Проверяем, что ник не пустой
            if (!minecraftUsername) {
              await ctx.reply('Ник не может быть пустым. Пожалуйста, введите ваш ник в Minecraft:', {
                reply_markup: new InlineKeyboard().text("Отменить", "cancel_apply")
              });
              return;
            }
            
            // Сохраняем ник и переходим к следующему шагу
            ctx.session.minecraftUsername = minecraftUsername;
            ctx.session.applyStep = 2;
            await ctx.reply('Теперь, пожалуйста, напишите, почему вы хотите присоединиться к нашему серверу:', {
              reply_markup: new InlineKeyboard().text("Отменить", "cancel_apply")
            });
          }
          break;
          
        case 2: // Ввод причины для заявки
          if (ctx.message && 'text' in ctx.message) {
            const reason = ctx.message.text?.trim() || '';
            
            // Проверяем, что причина не пустая
            if (!reason) {
              await ctx.reply('Причина не может быть пустой. Пожалуйста, укажите причину:', {
                reply_markup: new InlineKeyboard().text("Отменить", "cancel_apply")
              });
              return;
            }
            
            // Сохраняем причину
            ctx.session.applicationReason = reason;
            
            // Создаем заявку
            const application = await this.applicationService.createApplication(
              ctx.from!.id,
              ctx.session.minecraftUsername!,
              reason
            );
            
            if (application) {
              // Обновляем роль пользователя на GUEST
              await this.roleController.setGuestRole(ctx.from!.id);
              
              // Сбрасываем состояние заполнения заявки
              ctx.session.applyStep = undefined;
              ctx.session.minecraftUsername = undefined;
              ctx.session.applicationReason = undefined;
              
              // Уведомляем пользователя о создании заявки
              await ctx.reply(
                `Ваша заявка успешно создана!\n\n` +
                `Ник в Minecraft: ${application.minecraftUsername}\n` +
                `Причина: ${application.reason}\n\n` +
                `Заявка будет рассмотрена участниками сервера. Процесс голосования займет до 24 часов. ` +
                `Вы получите уведомление о результате.`,
                {
                  reply_markup: new InlineKeyboard()
                    .text("Проверить статус", "status")
                    .row()
                    .text("Профиль", "profile")
                    .row()
                    .text("На главную", "start")
                }
              );
              
              // Обновляем клавиатуру после успешной подачи заявки
              await ctx.reply('Ваш профиль обновлен. Теперь вам доступны новые функции:', {
                reply_markup: this.keyboardService.getGuestKeyboard()
              });
              
              // Рассылаем уведомление о новой заявке участникам с правом голоса
              this.notifyVotersAboutNewApplication(application);
            } else {
              await ctx.reply('Произошла ошибка при создании заявки. Пожалуйста, попробуйте позже.', {
                reply_markup: new InlineKeyboard().text("На главную", "start")
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Ошибка при обработке шага заполнения заявки:', error);
      await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
      
      // Сбрасываем состояние заполнения заявки
      ctx.session.applyStep = undefined;
      ctx.session.minecraftUsername = undefined;
      ctx.session.applicationReason = undefined;
    }
  }

  /**
   * Обработчик отмены заполнения заявки
   * @param ctx - Контекст Telegram
   */
  async cancelApply(ctx: MyContext): Promise<void> {
    // Сбрасываем состояние заполнения заявки
    ctx.session.applyStep = undefined;
    ctx.session.minecraftUsername = undefined;
    ctx.session.applicationReason = undefined;
    
    await ctx.reply('Заполнение заявки отменено.', {
      reply_markup: new InlineKeyboard()
        .text("На главную", "start")
    });
  }

  /**
   * Обработчик команды /status для проверки статуса заявки
   * @param ctx - Контекст Telegram
   */
  async checkStatus(ctx: MyContext): Promise<void> {
    try {
      // Получаем последнюю заявку пользователя
      const application = await this.getLastApplication(ctx.from!.id);
      
      if (!application) {
        const keyboard = new InlineKeyboard()
          .text("Подать заявку", "apply")
          .row()
          .text("На главную", "start");
          
        await ctx.reply('У вас нет активных заявок. Чтобы подать заявку, используйте кнопки ниже:', 
          { reply_markup: keyboard });
        return;
      }
      
      // Формируем сообщение в зависимости от статуса заявки
      let statusMessage = '';
      let keyboard = new InlineKeyboard();
      
      switch (application.status) {
        case ApplicationStatus.PENDING:
          const votesInfo = `Голоса: 👍 ${application.votesPositive} | 👎 ${application.votesNegative}`;
          const timeLeft = this.getTimeLeftForVoting(application.votingEndsAt);
          statusMessage = `Ваша заявка находится на рассмотрении.\n\n${votesInfo}\n${timeLeft}`;
          keyboard.text("Обновить статус", "status").row().text("На главную", "start");
          break;
          
        case ApplicationStatus.APPROVED:
          statusMessage = 'Ваша заявка была одобрена! Вы можете присоединиться к серверу.';
          keyboard.text("На главную", "start");
          break;
          
        case ApplicationStatus.REJECTED:
          statusMessage = 'К сожалению, ваша заявка была отклонена участниками сервера.';
          keyboard.text("Подать новую заявку", "apply").row().text("На главную", "start");
          break;
          
        case ApplicationStatus.EXPIRED:
          statusMessage = 'Ваша заявка была отклонена из-за недостаточного количества голосов.';
          keyboard.text("Подать новую заявку", "apply").row().text("На главную", "start");
          break;
          
        case ApplicationStatus.BANNED:
          statusMessage = 'Ваша заявка была заблокирована администратором.';
          keyboard.text("На главную", "start");
          break;
      }
      
      await ctx.reply(statusMessage, { reply_markup: keyboard });
    } catch (error) {
      console.error('Ошибка при проверке статуса заявки:', error);
      await ctx.reply('Произошла ошибка при проверке статуса вашей заявки. Пожалуйста, попробуйте позже.', 
        { reply_markup: new InlineKeyboard().text("На главную", "start") });
    }
  }

  /**
   * Получение времени, оставшегося до окончания голосования
   * @param votingEndsAt - Дата окончания голосования
   * @returns Строка с форматированным временем
   */
  private getTimeLeftForVoting(votingEndsAt: Date): string {
    const now = new Date();
    const timeLeftMs = votingEndsAt.getTime() - now.getTime();
    
    if (timeLeftMs <= 0) {
      return 'Голосование завершено, результаты обрабатываются.';
    }
    
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `Голосование закончится через ${hoursLeft} ч. ${minutesLeft} мин.`;
  }

  /**
   * Получение последней заявки пользователя
   * @param telegramId - ID пользователя в Telegram
   * @returns Данные заявки или null
   */
  async getLastApplication(telegramId: number): Promise<Application | null> {
    // Этот метод используется в других методах класса
    try {
      const application = await this.applicationService.getLastApplication(telegramId);
      return application;
    } catch (error) {
      console.error('Ошибка при получении последней заявки пользователя:', error);
      return null;
    }
  }

  /**
   * Рассылает уведомление о новой заявке участникам с правом голоса
   * @param application - Новая заявка
   */
  private async notifyVotersAboutNewApplication(application: Application): Promise<void> {
    await this.notificationService.notifyAboutNewApplication(application);
  }

  /**
   * Голосование за заявку
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   * @param isPositive - Тип голоса (за/против)
   */
  async voteForApplication(ctx: MyContext, applicationId: number, isPositive: boolean): Promise<void> {
    try {
      // Получаем текущего пользователя
      const user = await UserModel.getByTelegramId(ctx.from!.id);
      
      if (!user) {
        await ctx.reply('Вы не зарегистрированы в системе.');
        return;
      }

      // Проверяем, имеет ли пользователь право голоса
      if (!user.canVote && user.role !== UserRole.ADMIN) {
        await ctx.reply('У вас нет прав для голосования за заявки.');
        return;
      }

      // Голосуем за заявку
      const result = await this.applicationService.voteForApplication(applicationId, ctx.from!.id, isPositive);
      
      if (result) {
        await ctx.reply(`Ваш голос ${isPositive ? '"За"' : '"Против"'} по заявке #${applicationId} учтен.`);
      } else {
        await ctx.reply('Не удалось проголосовать. Возможно, вы уже голосовали за эту заявку или заявка больше не активна.');
      }
    } catch (error) {
      console.error('Ошибка при голосовании за заявку:', error);
      await ctx.reply('Произошла ошибка при обработке вашего голоса. Пожалуйста, попробуйте позже.');
    }
  }
} 