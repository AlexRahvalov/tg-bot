import { InlineKeyboard } from 'grammy';
import { ButtonComponents } from '../components/buttons';

/**
 * Утилиты для создания клавиатур
 */
export class KeyboardUtils {
  /**
   * Создает простую клавиатуру с кнопкой "Назад"
   * @param backCallback Callback для кнопки "Назад"
   * @returns InlineKeyboard
   */
  static createBackKeyboard(backCallback: string): InlineKeyboard {
    return ButtonComponents.back(backCallback);
  }

  /**
   * Создает клавиатуру с кнопками "Да" и "Нет"
   * @param yesCallback Callback для кнопки "Да"
   * @param noCallback Callback для кнопки "Нет"
   * @returns InlineKeyboard
   */
  static createConfirmKeyboard(yesCallback: string, noCallback: string): InlineKeyboard {
    return ButtonComponents.confirm(yesCallback, noCallback);
  }

  /**
   * Создает клавиатуру для голосования
   * @param applicationId ID заявки
   * @param includeQuestion Включить кнопку "Задать вопрос"
   * @param includeDetails Включить кнопку "Подробнее"
   * @returns InlineKeyboard
   */
  static createVotingKeyboard(
    applicationId: number, 
    includeQuestion: boolean = true, 
    includeDetails: boolean = true
  ): InlineKeyboard {
    return ButtonComponents.fullVoting(applicationId);
  }

  /**
   * Создает клавиатуру для управления заявкой (админ)
   * @param applicationId ID заявки
   * @param includeApprove Включить кнопку "Одобрить"
   * @param includeReject Включить кнопку "Отклонить"
   * @param includeStartVoting Включить кнопку "Начать голосование"
   * @returns InlineKeyboard
   */
  static createApplicationManagementKeyboard(
    applicationId: number,
    includeApprove: boolean = true,
    includeReject: boolean = true,
    includeStartVoting: boolean = true
  ): InlineKeyboard {
    return ButtonComponents.adminApplicationActions(applicationId, 'PENDING');
  }

  /**
   * Создает клавиатуру для рейтинга пользователя
   * @param userId ID пользователя
   * @param includeNegative Включить кнопку отрицательного рейтинга
   * @returns InlineKeyboard
   */
  static createRatingKeyboard(userId: number, includeNegative: boolean = true): InlineKeyboard {
    return ButtonComponents.rating(userId);
  }

  /**
   * Создает клавиатуру для навигации с кнопками плюс/минус
   * @param plusCallback Callback для кнопки "+"
   * @param minusCallback Callback для кнопки "-"
   * @param value Текущее значение
   * @param unit Единица измерения
   * @returns InlineKeyboard
   */
  static createPlusMinusKeyboard(
    plusCallback: string,
    minusCallback: string,
    value: number,
    unit: string = ''
  ): InlineKeyboard {
    return ButtonComponents.plusMinus(plusCallback, minusCallback, value, unit);
  }

  /**
   * Создает клавиатуру для просмотра профиля
   * @param userId ID пользователя
   * @param canRate Может ли текущий пользователь оценивать
   * @returns InlineKeyboard
   */
  static createProfileViewKeyboard(userId: number, canRate: boolean = false): InlineKeyboard {
    if (canRate) {
      return ButtonComponents.rating(userId);
    }
    return ButtonComponents.back('back_to_members');
  }

  /**
   * Добавляет кнопку "Назад" к существующей клавиатуре
   * @param keyboard Существующая клавиатура
   * @param backCallback Callback для кнопки "Назад"
   * @returns InlineKeyboard
   */
  static addBackButton(keyboard: InlineKeyboard, backCallback: string): InlineKeyboard {
    return keyboard.row().text('🔙 Назад', backCallback);
  }

  /**
   * Создает пустую клавиатуру
   * @returns InlineKeyboard
   */
  static createEmptyKeyboard(): InlineKeyboard {
    return new InlineKeyboard();
  }
}