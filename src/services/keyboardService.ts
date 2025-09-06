import { Keyboard, InlineKeyboard } from 'grammy';
import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';
import { ButtonComponents } from '../components/buttons';

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
    const keyboard = new Keyboard();
    
    if (userId) {
      try {
        const user = await this.userRepository.findByTelegramId(userId);
        logger.info(`KeyboardService: Проверка пользователя ${userId}, найден: ${user ? `${user.username} (${user.role})` : 'не найден'}`);
        
        if (user && (user.role === UserRole.MEMBER || user.role === UserRole.ADMIN)) {
          // Для участников и админов показываем кнопки профиля и участников
          keyboard.text("👤 Профиль").text("👥 Участники").row();
          keyboard.text("🗳️ Активные заявки").row();
          keyboard.text("ℹ️ Помощь").text("📋 О сервере").row();
          
          // Для админов добавляем кнопку админ-панели
          if (user.role === UserRole.ADMIN) {
            keyboard.text("🛠️ Админ-панель").row();
          }
        } else {
          // Для заявителей и неавторизованных пользователей показываем кнопки подачи заявки
          keyboard.text("📝 Подать заявку").text("📊 Статус заявки").row();
          keyboard.text("ℹ️ Помощь").text("📋 О сервере").row();
        }
      } catch (error) {
        logger.error("Ошибка при проверке прав пользователя:", error);
        // В случае ошибки показываем базовые кнопки
        keyboard.text("📝 Подать заявку").text("📊 Статус заявки").row();
        keyboard.text("ℹ️ Помощь").text("📋 О сервере").row();
      }
    } else {
      // Для неавторизованных пользователей показываем кнопки подачи заявки
      keyboard.text("📝 Подать заявку").text("📊 Статус заявки").row();
      keyboard.text("ℹ️ Помощь").text("📋 О сервере").row();
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
    return ButtonComponents.adminPanel()
      .row()
      .text("🔙 Вернуться в главное меню", "admin_back_to_main");
  }
  
  /**
   * Создает клавиатуру для управления пользователями
   * @returns Inline-клавиатура для управления пользователями
   */
  getUsersManagementKeyboard(): InlineKeyboard {
    return ButtonComponents.userManagement()
      .row()
      .text("🔙 Назад к админ-панели", "admin_back");
  }
  
  /**
   * Создает клавиатуру для управления заявками
   * @returns Inline-клавиатура для управления заявками
   */
  getApplicationsManagementKeyboard(): InlineKeyboard {
    return ButtonComponents.applicationsList()
      .row()
      .text("🔙 Назад к админ-панели", "admin_back");
  }
  
  /**
   * Создает клавиатуру для управления конкретной заявкой
   * @param applicationId ID заявки
   * @param isPending Находится ли заявка в статусе ожидания
   * @returns Inline-клавиатура с действиями для заявки
   */
  getApplicationActionKeyboard(applicationId: number, isPending: boolean): InlineKeyboard {
    return ButtonComponents.applicationManagement(applicationId, isPending)
      .row()
      .text("🔙 Назад к списку", "admin_apps_active");
  }
  
  /**
   * Создает клавиатуру для голосования по заявке
   * @param applicationId ID заявки
   * @param hasVoted Голосовал ли уже пользователь
   * @returns Inline-клавиатура с кнопками голосования
   */
  getVotingKeyboard(applicationId: number, hasVoted: boolean): InlineKeyboard {
    return ButtonComponents.fullVoting(applicationId, hasVoted);
  }
  
  /**
   * Создает клавиатуру для настроек сервера
   * @returns Inline-клавиатура с настройками сервера
   */
  getServerSettingsKeyboard(): InlineKeyboard {
    return ButtonComponents.serverSettings()
      .row()
      .text("🔙 Назад к админ-панели", "admin_back");
  }
  
  /**
   * Создает клавиатуру для настроек голосования
   * @returns Inline-клавиатура с настройками голосования
   */
  getVotingSettingsKeyboard(votingDurationDays: number, votingDurationHours: number, votingDurationMinutes: number): InlineKeyboard {
    return ButtonComponents.votingTimeSettings(votingDurationDays, votingDurationHours, votingDurationMinutes)
      .row()
      .text("🔙 Назад к настройкам", "admin_settings");
  }
  
  /**
   * Создает клавиатуру для настроек рейтинга
   * @returns Inline-клавиатура с настройками рейтинга
   */
  getRatingSettingsKeyboard(): InlineKeyboard {
    return ButtonComponents.ratingSettings()
      .row()
      .text("🔙 Назад к настройкам", "admin_settings");
  }
  
  /**
   * Создает клавиатуру для настройки времени голосования с заданными значениями
   * @param days Количество дней
   * @param hours Количество часов
   * @param minutes Количество минут
   * @returns Inline-клавиатура для настройки времени
   */
  getVotingTimeSettingsKeyboard(days: number, hours: number, minutes: number): InlineKeyboard {
    return ButtonComponents.votingTimeSettings(days, hours, minutes)
      .row()
      .text("🔙 Назад к настройкам", "admin_settings");
  }
  
  /**
   * Создает клавиатуру для настройки минимального количества голосов
   * @param minVotes Минимальное количество голосов
   * @returns Inline-клавиатура для настройки минимального количества голосов
   */
  getMinVotesSettingsKeyboard(minVotes: number): InlineKeyboard {
    return ButtonComponents.plusMinusSettings(minVotes, "min_votes")
      .row()
      .text("🔙 Назад к настройкам", "admin_settings");
  }
  
  /**
   * Создает клавиатуру для настройки порога отрицательных оценок
   * @param threshold Порог отрицательных оценок
   * @returns Inline-клавиатура для настройки порога отрицательных оценок
   */
  getNegativeThresholdSettingsKeyboard(threshold: number): InlineKeyboard {
    return ButtonComponents.plusMinusSettings(threshold, "neg_threshold")
      .row()
      .text("🔙 Назад к настройкам", "admin_settings");
  }
}

// Создаем и экспортируем инстанс сервиса
export const keyboardService = new KeyboardService();