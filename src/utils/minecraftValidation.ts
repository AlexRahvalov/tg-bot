/**
 * Утилиты для валидации Minecraft никнеймов
 * Основано на официальных правилах Mojang
 */

/**
 * Результат валидации никнейма
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: string;
}

/**
 * Валидация никнейма Minecraft согласно правилам Mojang
 * 
 * Правила:
 * - Длина: от 3 до 16 символов
 * - Разрешённые символы: латинские буквы (A-Z, a-z), цифры (0-9), подчёркивание (_)
 * - Регулярное выражение: ^[a-zA-Z0-9_]{3,16}$
 * 
 * @param nickname Никнейм для проверки
 * @returns Результат валидации с подробным описанием ошибки
 */
export function validateMinecraftNickname(nickname: string): ValidationResult {
  // Убираем лишние пробелы
  const trimmedNickname = nickname.trim();
  
  // Проверка на пустоту
  if (!trimmedNickname) {
    return {
      isValid: false,
      error: 'Никнейм не может быть пустым',
      details: 'Пожалуйста, введите ваш игровой никнейм.'
    };
  }
  
  // Проверка длины - слишком короткий
  if (trimmedNickname.length < 3) {
    return {
      isValid: false,
      error: 'Никнейм слишком короткий',
      details: `Минимальная длина никнейма: 3 символа. Ваш никнейм содержит ${trimmedNickname.length} символ${trimmedNickname.length === 1 ? '' : trimmedNickname.length < 5 ? 'а' : 'ов'}.`
    };
  }
  
  // Проверка длины - слишком длинный
  if (trimmedNickname.length > 16) {
    return {
      isValid: false,
      error: 'Никнейм слишком длинный',
      details: `Максимальная длина никнейма: 16 символов. Ваш никнейм содержит ${trimmedNickname.length} символов.`
    };
  }
  
  // Проверка на недопустимые символы
  const validPattern = /^[a-zA-Z0-9_]+$/;
  if (!validPattern.test(trimmedNickname)) {
    // Найдём первый недопустимый символ для более точного сообщения
    const invalidChars = trimmedNickname.split('').filter(char => !/[a-zA-Z0-9_]/.test(char));
    const uniqueInvalidChars = [...new Set(invalidChars)];
    
    return {
      isValid: false,
      error: 'Никнейм содержит недопустимые символы',
      details: `Разрешены только латинские буквы (A-Z, a-z), цифры (0-9) и подчёркивание (_).\n` +
               `Найдены недопустимые символы: ${uniqueInvalidChars.map(char => `"${char}"`).join(', ')}`
    };
  }
  
  // Все проверки пройдены
  return {
    isValid: true
  };
}

/**
 * Форматирует сообщение об ошибке валидации для отправки пользователю
 * 
 * @param result Результат валидации
 * @returns Отформатированное сообщение об ошибке
 */
export function formatValidationError(result: ValidationResult): string {
  if (result.isValid) {
    return '';
  }
  
  let message = `❌ ${result.error}\n\n`;
  
  if (result.details) {
    message += `${result.details}\n\n`;
  }
  
  message += '📋 **Правила для никнейма Minecraft:**\n';
  message += '• Длина: от 3 до 16 символов\n';
  message += '• Разрешённые символы: латинские буквы (A-Z, a-z), цифры (0-9), подчёркивание (_)\n';
  message += '• Примеры валидных никнеймов: Steve, Notch, Alex_123, Player1\n\n';
  message += 'Пожалуйста, введите корректный никнейм:';
  
  return message;
}

/**
 * Примеры использования и тестовые случаи
 */
export const VALIDATION_EXAMPLES = {
  valid: ['Steve', 'Notch', 'Alex_123', 'Player1', 'abc', 'Test_User_2024'],
  invalid: {
    tooShort: ['ab', 'x', '12'],
    tooLong: ['ThisNameIsWayTooLong17', 'VeryLongNicknameExample'],
    invalidChars: ['alex!', 'ник', 'player@home', 'test-user', 'name with spaces']
  }
};