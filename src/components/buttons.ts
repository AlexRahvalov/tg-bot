import { InlineKeyboard } from 'grammy';

/**
 * Компоненты кнопок для Telegram бота
 * Централизованное создание различных типов кнопок
 */
export class ButtonComponents {
  
  // ==================== НАВИГАЦИОННЫЕ КНОПКИ ====================
  
  /**
   * Кнопка "Назад"
   * @param callback Callback для кнопки
   * @param text Текст кнопки (по умолчанию "🔙 Назад")
   */
  static back(callback: string, text: string = '🔙 Назад'): InlineKeyboard {
    return new InlineKeyboard().text(text, callback);
  }
  
  /**
   * Кнопка "Главное меню"
   * @param callback Callback для кнопки
   */
  static mainMenu(callback: string = 'main_menu'): InlineKeyboard {
    return new InlineKeyboard().text('🏠 Главное меню', callback);
  }
  
  /**
   * Кнопка "Отмена"
   * @param callback Callback для кнопки
   */
  static cancel(callback: string = 'cancel'): InlineKeyboard {
    return new InlineKeyboard().text('❌ Отмена', callback);
  }

  /**
   * Создает клавиатуру с кнопками "Подтвердить" и "Отмена"
   */
  static confirmCancel(confirmCallback: string, cancelCallback: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Подтвердить', confirmCallback)
      .text('❌ Отмена', cancelCallback);
  }

  /**
   * Создает клавиатуру с одной кнопкой
   */
  static singleButton(text: string, callback: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(text, callback);
  }
  
  // ==================== КНОПКИ ПОДТВЕРЖДЕНИЯ ====================
  
  /**
   * Кнопки "Да" и "Нет"
   * @param yesCallback Callback для кнопки "Да"
   * @param noCallback Callback для кнопки "Нет"
   */
  static confirm(yesCallback: string, noCallback: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Да', yesCallback)
      .text('❌ Нет', noCallback);
  }
  
  /**
   * Кнопка "Сохранить"
   * @param callback Callback для кнопки
   */
  static save(callback: string): InlineKeyboard {
    return new InlineKeyboard().text('💾 Сохранить', callback);
  }
  
  // ==================== КНОПКИ ГОЛОСОВАНИЯ ====================
  
  /**
   * Кнопки голосования "За" и "Против"
   * @param applicationId ID заявки
   */
  static voting(applicationId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('👍 За', `vote_positive_${applicationId}`)
      .text('👎 Против', `vote_negative_${applicationId}`);
  }
  
  /**
   * Кнопка "Задать вопрос"
   * @param applicationId ID заявки
   */
  static askQuestion(applicationId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('❓ Задать вопрос', `ask_question_${applicationId}`);
  }
  
  /**
   * Кнопка "Подробнее о заявке"
   * @param applicationId ID заявки
   */
  static viewDetails(applicationId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔍 Подробнее', `vote_view_${applicationId}`);
  }
  
  /**
   * Полная клавиатура для голосования
   * @param applicationId ID заявки
   * @param hasVoted Уже проголосовал ли пользователь
   */
  static fullVoting(applicationId: number, hasVoted: boolean = false): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    if (!hasVoted) {
      keyboard
        .text('👍 За', `vote_positive_${applicationId}`)
        .text('👎 Против', `vote_negative_${applicationId}`).row()
        .text('❓ Задать вопрос', `ask_question_${applicationId}`).row();
    }
    
    keyboard.text('🔍 Подробнее', `vote_view_${applicationId}`);
    
    return keyboard;
  }
  
  // ==================== АДМИНСКИЕ КНОПКИ ====================
  
  /**
   * Кнопки управления заявкой (админ)
   * @param applicationId ID заявки
   * @param isPending Находится ли заявка в ожидании
   */
  static applicationManagement(applicationId: number, isPending: boolean = true): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    if (isPending) {
      keyboard.text('▶️ Начать голосование', `app_start_voting_${applicationId}`).row();
    }
    
    keyboard
      .text('✅ Одобрить', `app_approve_${applicationId}`)
      .text('❌ Отклонить', `app_reject_${applicationId}`).row()
      .text('❓ Задать вопрос', `ask_question_${applicationId}`)
      .text('📋 Вопросы', `view_questions_${applicationId}`).row();
    
    return keyboard;
  }
  
  /**
   * Кнопки действий с заявкой для админ-панели
   * @param applicationId ID заявки
   * @param status Статус заявки
   */
  static adminApplicationActions(applicationId: number, status: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    if (status === 'PENDING') {
      keyboard
        .text('✅ Принять', `app_approve_${applicationId}`)
        .text('❌ Отклонить', `app_reject_${applicationId}`).row()
        .text('🗳️ Голосование', `app_start_voting_${applicationId}`).row();
    } else if (status === 'VOTING') {
      keyboard
        .text('✅ Принять', `app_approve_${applicationId}`)
        .text('❌ Отклонить', `app_reject_${applicationId}`).row();
    }
    
    return keyboard;
  }
  
  /**
   * Кнопки админ-панели
   */
  static adminPanel(): InlineKeyboard {
    return new InlineKeyboard()
      .text('👥 Управление пользователями', 'admin_users').row()
      .text('🗳️ Управление заявками', 'admin_applications').row()
      .text('⚙️ Настройки сервера', 'admin_settings').row();
  }
  
  /**
   * Кнопки управления пользователями
   */
  static userManagement(): InlineKeyboard {
    return new InlineKeyboard()
      .text('👤 Список пользователей', 'admin_users_list').row()
      .text('🔄 Изменить роль пользователя', 'admin_users_change_role').row();
  }
  
  /**
   * Кнопки управления заявками
   */
  static applicationsList(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📋 Активные заявки', 'admin_apps_active').row()
      .text('✅ Одобренные заявки', 'admin_apps_approved').row()
      .text('❌ Отклоненные заявки', 'admin_apps_rejected').row();
  }
  
  /**
   * Кнопки настроек сервера
   */
  static serverSettings(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⏱️ Время голосования', 'admin_settings_voting_time').row()
      .text('📊 Настройка порогов голосования', 'admin_settings_thresholds').row()
      .text('📡 Настройки Minecraft-сервера', 'admin_settings_minecraft').row();
  }
  
  // ==================== КНОПКИ НАСТРОЕК ====================
  
  /**
   * Кнопки плюс/минус для числовых настроек
   * @param plusCallback Callback для кнопки "+"
   * @param minusCallback Callback для кнопки "-"
   * @param value Текущее значение
   * @param unit Единица измерения
   */
  static plusMinus(plusCallback: string, minusCallback: string, value: number, unit: string = ''): InlineKeyboard {
    const displayValue = unit ? `${value} ${unit}` : value.toString();
    return new InlineKeyboard()
      .text('➖', minusCallback)
      .text(displayValue, 'info')
      .text('➕', plusCallback);
  }
  
  /**
   * Кнопки настроек голосования
   */
  static votingSettings(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⏱️ Время голосования', 'admin_settings_voting_time').row()
      .text('📊 Минимум голосов', 'admin_settings_min_votes').row();
  }
  
  /**
   * Кнопки настроек рейтинга
   */
  static ratingSettings(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📉 Порог негативных оценок', 'admin_settings_negative_threshold').row()
      .text('⭐ Настройки рейтинга', 'admin_settings_rating_config').row();
  }
  
  /**
   * Кнопки плюс/минус для настроек с сохранением
   * @param value Текущее значение
   * @param settingType Тип настройки для callback'ов
   */
  static plusMinusSettings(value: number, settingType: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('➖', `${settingType}_minus`)
      .text(value.toString(), 'info')
      .text('➕', `${settingType}_plus`).row()
      .text('✅ Сохранить', `${settingType}_save`);
  }
  
  /**
   * Кнопки настройки времени голосования
   * @param days Дни
   * @param hours Часы
   * @param minutes Минуты
   */
  static votingTimeSettings(days: number, hours: number, minutes: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('➖', 'voting_days_minus')
      .text(`${days} дн.`, 'voting_days_info')
      .text('➕', 'voting_days_plus').row()
      .text('➖', 'voting_hours_minus')
      .text(`${hours} ч.`, 'voting_hours_info')
      .text('➕', 'voting_hours_plus').row()
      .text('➖', 'voting_minutes_minus')
      .text(`${minutes} мин.`, 'voting_minutes_info')
      .text('➕', 'voting_minutes_plus').row()
      .text('✅ Сохранить', 'voting_time_save');
  }
  
  // ==================== КНОПКИ РЕЙТИНГА ====================
  
  /**
   * Кнопки оценки пользователя
   * @param userId ID пользователя
   */
  static rating(userId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('👍 Положительно', `rate_positive_${userId}`)
      .text('👎 Отрицательно', `rate_negative_${userId}`);
  }
  
  /**
   * Кнопки просмотра рейтинга
   * @param userId ID пользователя
   */
  static viewRating(userId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Посмотреть рейтинг', `view_rating_${userId}`);
  }
  
  // ==================== УТИЛИТЫ ====================
  
  /**
   * Добавляет кнопку "Назад" к существующей клавиатуре
   * @param keyboard Существующая клавиатура
   * @param callback Callback для кнопки "Назад"
   */
  static addBack(keyboard: InlineKeyboard, callback: string): InlineKeyboard {
    return keyboard.row().text('🔙 Назад', callback);
  }
  
  /**
   * Добавляет кнопку "Главное меню" к существующей клавиатуре
   * @param keyboard Существующая клавиатура
   * @param callback Callback для кнопки
   */
  static addMainMenu(keyboard: InlineKeyboard, callback: string = 'main_menu'): InlineKeyboard {
    return keyboard.row().text('🏠 Главное меню', callback);
  }
  
  /**
   * Создает пустую клавиатуру
   */
  static empty(): InlineKeyboard {
    return new InlineKeyboard();
  }
}