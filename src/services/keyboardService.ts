import { Keyboard, InlineKeyboard } from 'grammy';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';

/**
 * Сервис для работы с клавиатурами в боте
 */
class KeyboardService {
  private userRepository: UserRepository;
  
  constructor() {
    this.userRepository = new UserRepository();
  }
  
  /**
   * Создает основную клавиатуру с учетом прав пользователя
   * @param userId ID пользователя в Telegram
   * @returns Клавиатура с доступными кнопками
   */
  async getMainKeyboard(userId?: number): Promise<Keyboard> {
    const keyboard = new Keyboard()
      .text("📝 Подать заявку").text("📊 Статус заявки").row()
      .text("ℹ️ Помощь").text("📋 О сервере").row();
      
    // Если пользователь — админ, добавляем кнопку админ-панели
    if (userId) {
      try {
        const user = await this.userRepository.findByTelegramId(userId);
        if (user && user.role === UserRole.ADMIN) {
          keyboard.text("🛠️ Админ-панель");
        }
        
        // Для участников добавляем кнопку просмотра участников и просмотра активных заявок
        if (user && (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN)) {
          keyboard.text("👥 Участники").row();
          keyboard.text("🗳️ Активные заявки").row();
        }
      } catch (error) {
        logger.error("Ошибка при проверке прав пользователя:", error);
      }
    }
    
    return keyboard.resized();
  }
  
  /**
   * Создание клавиатуры для ожидания ввода
   */
  getWaitingKeyboard(): Keyboard {
    return new Keyboard()
      .text("❌ Отменить").row()
      .resized();
  }
  
  /**
   * Создание клавиатуры для просмотра статуса заявки
   */
  getStatusViewKeyboard(): Keyboard {
    return new Keyboard()
      .text("📝 Подать заявку").row()
      .text("📋 О сервере").text("ℹ️ Помощь").row()
      .resized();
  }
  
  /**
   * Создает клавиатуру для админ-панели
   * @returns Inline-клавиатура с кнопками админ-панели
   */
  getAdminPanelKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("👥 Управление пользователями", "admin_users").row()
      .text("🗳️ Управление заявками", "admin_applications").row()
      .text("⚙️ Настройки сервера", "admin_settings").row()
      .text("🔙 Вернуться в главное меню", "admin_back_to_main").row();
  }
  
  /**
   * Создает клавиатуру для управления пользователями
   * @returns Inline-клавиатура для управления пользователями
   */
  getUsersManagementKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("👤 Список пользователей", "admin_users_list").row()
      .text("🔄 Изменить роль пользователя", "admin_users_change_role").row()
      .text("🔙 Назад к админ-панели", "admin_back").row();
  }
  
  /**
   * Создает клавиатуру для управления заявками
   * @returns Inline-клавиатура для управления заявками
   */
  getApplicationsManagementKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("📋 Активные заявки", "admin_apps_active").row()
      .text("✅ Одобренные заявки", "admin_apps_approved").row()
      .text("❌ Отклоненные заявки", "admin_apps_rejected").row()
      .text("🔙 Назад к админ-панели", "admin_back").row();
  }
  
  /**
   * Создает клавиатуру для управления конкретной заявкой
   * @param applicationId ID заявки
   * @param isPending Находится ли заявка в статусе ожидания
   * @returns Inline-клавиатура с действиями для заявки
   */
  getApplicationActionKeyboard(applicationId: number, isPending: boolean): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    if (isPending) {
      keyboard
        .text("▶️ Начать голосование", `app_start_voting_${applicationId}`).row()
        .text("✅ Одобрить", `app_approve_${applicationId}`).text("❌ Отклонить", `app_reject_${applicationId}`).row();
    } else {
      keyboard
        .text("✅ Одобрить", `app_approve_${applicationId}`).text("❌ Отклонить", `app_reject_${applicationId}`).row();
    }
    
    keyboard.text("🔙 Назад к списку", "admin_apps_active").row();
    
    return keyboard;
  }
  
  /**
   * Создает клавиатуру для голосования по заявке
   * @param applicationId ID заявки
   * @param hasVoted Голосовал ли уже пользователь
   * @returns Inline-клавиатура с кнопками голосования
   */
  getVotingKeyboard(applicationId: number, hasVoted: boolean): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    if (!hasVoted) {
      keyboard
        .text("👍 За", `vote_positive_${applicationId}`)
        .text("👎 Против", `vote_negative_${applicationId}`).row()
        .text("❓ Задать вопрос", `ask_question_${applicationId}`).row();
    }
    
    return keyboard;
  }
  
  /**
   * Создает клавиатуру для настроек сервера
   * @returns Inline-клавиатура с настройками сервера
   */
  getServerSettingsKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("⏱️ Время голосования", "admin_settings_voting_time").row()
      .text("📊 Настройка порогов голосования", "admin_settings_thresholds").row()
      .text("📡 Настройки Minecraft-сервера", "admin_settings_minecraft").row()
      .text("🔙 Назад к админ-панели", "admin_back").row();
  }
  
  /**
   * Создает клавиатуру для настройки времени голосования
   * @returns Inline-клавиатура с управлением временем голосования
   */
  getVotingTimeSettingsKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text("➕ День", "voting_time_add_day").text("➖ День", "voting_time_sub_day").row()
      .text("➕ Час", "voting_time_add_hour").text("➖ Час", "voting_time_sub_hour").row()
      .text("➕ 10 мин", "voting_time_add_10min").text("➖ 10 мин", "voting_time_sub_10min").row()
      .text("✅ Сохранить", "voting_time_save").row()
      .text("🔙 Назад к настройкам", "admin_settings").row();
  }
  
  /**
   * Создает клавиатуру для настройки времени голосования с заданными значениями
   * @param days Количество дней
   * @param hours Количество часов
   * @param minutes Количество минут
   * @returns Inline-клавиатура для настройки времени
   */
  getVotingSettingsKeyboard(days: number, hours: number, minutes: number): InlineKeyboard {
    return new InlineKeyboard()
      .text("➕", `voting_days_plus`).text(`${days} дн.`, "voting_days_info").text("➖", `voting_days_minus`).row()
      .text("➕", `voting_hours_plus`).text(`${hours} ч.`, "voting_hours_info").text("➖", `voting_hours_minus`).row()
      .text("➕", `voting_minutes_plus`).text(`${minutes} мин.`, "voting_minutes_info").text("➖", `voting_minutes_minus`).row()
      .text("✅ Сохранить", "voting_time_save").row()
      .text("🔙 Назад к настройкам", "admin_settings").row();
  }
  
  /**
   * Создает клавиатуру для настройки минимального количества голосов
   * @param minVotes Минимальное количество голосов
   * @returns Inline-клавиатура для настройки минимального количества голосов
   */
  getMinVotesSettingsKeyboard(minVotes: number): InlineKeyboard {
    return new InlineKeyboard()
      .text("➖", "min_votes_minus").text(`${minVotes}`, "min_votes_info").text("➕", "min_votes_plus").row()
      .text("✅ Сохранить", "min_votes_save").row()
      .text("🔙 Назад к настройкам", "admin_settings").row();
  }
  
  /**
   * Создает клавиатуру для настройки порога отрицательных оценок
   * @param threshold Порог отрицательных оценок
   * @returns Inline-клавиатура для настройки порога отрицательных оценок
   */
  getNegativeThresholdSettingsKeyboard(threshold: number): InlineKeyboard {
    return new InlineKeyboard()
      .text("➖", "neg_threshold_minus").text(`${threshold}`, "neg_threshold_info").text("➕", "neg_threshold_plus").row()
      .text("✅ Сохранить", "neg_threshold_save").row()
      .text("🔙 Назад к настройкам", "admin_settings").row();
  }
}

// Создаем и экспортируем инстанс сервиса
export const keyboardService = new KeyboardService(); 