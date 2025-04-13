import { Context, SessionFlavor, InlineKeyboard } from 'grammy';
import { ApplicationService } from '../services/application.service';
import { NotificationService } from '../services/notification.service';
import { UserModel } from '../models/user.model';
import { QuestionModel } from '../models/question.model';

// Определение типа для сессии
interface SessionData {
  askQuestionApplicationId?: number;
  answerQuestionApplicationId?: number;
  answerToUserId?: number;
}

// Расширенный тип контекста с сессией
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * Контроллер для обработки вопросов к заявкам
 */
export class QuestionsController {
  private applicationService: ApplicationService;
  private notificationService: NotificationService;

  constructor(bot: any, applicationService?: ApplicationService, notificationService?: NotificationService) {
    this.applicationService = applicationService || new ApplicationService();
    this.notificationService = notificationService || new NotificationService(bot);
  }

  /**
   * Обработка запроса на задание вопроса к заявке
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   */
  async askQuestionToApplicant(ctx: MyContext, applicationId: number): Promise<void> {
    try {
      // Устанавливаем состояние для запроса вопроса
      ctx.session.askQuestionApplicationId = applicationId;
      
      await ctx.reply(
        'Пожалуйста, напишите ваш вопрос к заявителю:',
        {
          reply_markup: new InlineKeyboard().text("Отменить", "cancel_question")
        }
      );
    } catch (error) {
      console.error('Ошибка при запросе на задание вопроса:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  }

  /**
   * Обработка текста вопроса от пользователя
   * @param ctx - Контекст Telegram
   */
  async processQuestion(ctx: MyContext): Promise<void> {
    try {
      // Проверяем, что пользователь находится в режиме задания вопроса
      if (!ctx.session.askQuestionApplicationId) {
        return;
      }

      // Получаем текст вопроса
      if (ctx.message && 'text' in ctx.message) {
        const question = ctx.message.text?.trim() || '';
        
        // Проверяем, что вопрос не пустой
        if (!question) {
          await ctx.reply('Вопрос не может быть пустым. Пожалуйста, введите ваш вопрос:');
          return;
        }
        
        // Получаем ID заявки из сессии
        const applicationId = ctx.session.askQuestionApplicationId;
        
        // Сохраняем вопрос в базе данных
        const savedQuestion = await this.applicationService.addQuestion(
          applicationId,
          ctx.from!.id,
          question
        );
        
        if (!savedQuestion) {
          await ctx.reply(
            `❌ Не удалось сохранить вопрос. Пожалуйста, попробуйте позже.`,
            {
              reply_markup: new InlineKeyboard().text("На главную", "start")
            }
          );
          ctx.session.askQuestionApplicationId = undefined;
          return;
        }
        
        // Отправляем вопрос через сервис уведомлений
        const success = await this.notificationService.sendQuestionToApplicant(
          ctx.from!.id,
          applicationId,
          question
        );
        
        // Сбрасываем состояние
        ctx.session.askQuestionApplicationId = undefined;
        
        if (success) {
          await ctx.reply(
            `✅ Ваш вопрос успешно отправлен заявителю.`,
            {
              reply_markup: new InlineKeyboard().text("На главную", "start")
            }
          );
        } else {
          await ctx.reply(
            `⚠️ Вопрос сохранен, но не удалось отправить уведомление заявителю.`,
            {
              reply_markup: new InlineKeyboard().text("На главную", "start")
            }
          );
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке вопроса:', error);
      await ctx.reply('Произошла ошибка при отправке вопроса. Пожалуйста, попробуйте позже.');
      
      // Сбрасываем состояние
      ctx.session.askQuestionApplicationId = undefined;
    }
  }

  /**
   * Отмена задания вопроса
   * @param ctx - Контекст Telegram
   */
  async cancelQuestion(ctx: MyContext): Promise<void> {
    // Сбрасываем состояние
    ctx.session.askQuestionApplicationId = undefined;
    
    await ctx.reply('Отправка вопроса отменена.', {
      reply_markup: new InlineKeyboard().text("На главную", "start")
    });
  }

  /**
   * Обработка ответа на вопрос
   * @param ctx - Контекст Telegram
   * @param applicationId - ID заявки
   * @param fromUserId - ID пользователя, задавшего вопрос
   * @param answer - Текст ответа
   */
  async processAnswer(ctx: MyContext, applicationId: number, fromUserId: number, answer: string): Promise<void> {
    try {
      // Проверка, что ответ не пустой
      if (!answer) {
        await ctx.reply('Ответ не может быть пустым. Пожалуйста, введите ответ:');
        return;
      }

      console.log(`Обработка ответа на вопрос: applicationId=${applicationId}, fromUserId=${fromUserId}`);
      
      // Получаем информацию о заявке
      const application = await this.applicationService.getApplicationById(applicationId);
      if (!application) {
        console.error(`Заявка не найдена: applicationId=${applicationId}`);
        await ctx.reply('Не удалось найти информацию о заявке. Попробуйте позже.');
        return;
      }
      
      // Получаем всех пользователей (в реальном приложении стоит добавить метод для получения пользователя по userId)
      const users = await UserModel.getAllUsers();
      const fromUser = users.find(user => user.id === fromUserId);
      
      if (!fromUser || !fromUser.telegramId) {
        console.error(`Пользователь не найден: userId=${fromUserId}`);
        await ctx.reply('Не удалось найти пользователя, задавшего вопрос. Попробуйте позже.');
        return;
      }
      
      // Находим последний неотвеченный вопрос от этого пользователя к этой заявке
      const questions = await QuestionModel.getUnansweredByApplicationId(applicationId);
      const questionFromUser = questions.find(q => q.fromUserId === fromUserId);
      
      if (!questionFromUser) {
        console.error(`Не найден неотвеченный вопрос от пользователя ${fromUserId} к заявке ${applicationId}`);
        await ctx.reply('Не удалось найти соответствующий вопрос. Возможно, на него уже был дан ответ.');
        return;
      }
      
      // Сохраняем ответ в базе данных
      const savedAnswer = await this.applicationService.addAnswer(questionFromUser.id!, answer);
      
      if (!savedAnswer) {
        await ctx.reply(
          `❌ Не удалось сохранить ответ. Пожалуйста, попробуйте позже.`,
          {
            reply_markup: new InlineKeyboard().text("На главную", "start")
          }
        );
        return;
      }

      // Отправляем ответ через notificationService
      try {
        if (!this.notificationService) {
          console.error('NotificationService не доступен в QuestionsController');
          await ctx.reply('Не удалось отправить ответ из-за технической ошибки. Пожалуйста, сообщите администратору.');
          return;
        }
        
        // Убедимся, что у ctx.from есть id и он корректный
        if (!ctx.from || !ctx.from.id) {
          console.error('Не удалось получить ID пользователя из контекста');
          await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.');
          return;
        }

        console.log(`Отправка ответа от пользователя: telegramId=${ctx.from.id}`);
        
        const success = await this.notificationService.sendAnswerToQuestion(
          ctx.from.id,
          fromUser.telegramId,
          applicationId,
          answer
        );
        
        if (success) {
          await ctx.reply(`✅ Ваш ответ успешно отправлен пользователю, задавшему вопрос.`);
        } else {
          await ctx.reply('⚠️ Ответ сохранен, но не удалось отправить уведомление пользователю.');
        }
      } catch (error) {
        console.error(`Ошибка при отправке ответа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        await ctx.reply('❌ Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.');
      }
    } catch (error) {
      console.error('Ошибка при обработке ответа на вопрос:', error);
      await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.', {
        reply_markup: new InlineKeyboard().text("На главную", "start")
      });
      
      // Сбрасываем состояние
      ctx.session.answerQuestionApplicationId = undefined;
      ctx.session.answerToUserId = undefined;
    }
  }

  /**
   * Отмена ответа на вопрос
   * @param ctx - Контекст Telegram
   */
  async cancelAnswer(ctx: MyContext): Promise<void> {
    // Сбрасываем состояние
    ctx.session.answerQuestionApplicationId = undefined;
    ctx.session.answerToUserId = undefined;
    
    await ctx.reply('Отправка ответа отменена.', {
      reply_markup: new InlineKeyboard().text("На главную", "start")
    });
  }
} 