/**
 * Утилиты для работы со строками
 */

/**
 * Функция для склонения существительных в зависимости от числа
 * @param count Число
 * @param one Форма для 1
 * @param few Форма для 2-4
 * @param many Форма для 5-20
 * @returns Правильная форма существительного
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return one;
  } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return few;
  } else {
    return many;
  }
}

/**
 * Форматирование текста с ограничением длины
 * @param text Исходный текст
 * @param maxLength Максимальная длина
 * @param ellipsis Символы для обозначения сокращения
 * @returns Сокращенный текст
 */
export function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Эскейпинг специальных символов Markdown для Telegram API
 * @param text Исходный текст
 * @returns Текст с эскейпинутыми символами
 */
export function escapeMarkdown(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

/**
 * Форматирование даты в читаемый вид
 * @param date Дата для форматирования
 * @returns Отформатированная дата в виде "DD.MM.YYYY HH:mm"
 */
export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
} 