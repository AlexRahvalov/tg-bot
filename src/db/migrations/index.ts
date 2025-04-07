import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { executeQuery } from '../connection';

/**
 * Выполнение миграций базы данных
 */
export const runMigrations = async (): Promise<void> => {
  try {
    console.log('📊 Запуск миграций базы данных...');
    
    // Получаем список всех файлов миграций
    const migrationFiles = await readdir(__dirname);
    
    // Фильтруем только SQL файлы и сортируем их по имени
    const sqlFiles = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Выполняем каждый файл миграции по очереди
    for (const sqlFile of sqlFiles) {
      console.log(`⏳ Выполнение миграции: ${sqlFile}`);
      
      // Чтение и выполнение SQL-скрипта
      const sqlPath = join(__dirname, sqlFile);
      const sql = await readFile(sqlPath, 'utf8');
      
      // Разделяем SQL на отдельные команды по разделителю ';'
      const sqlCommands = sql
        .split(';')
        .filter(command => command.trim().length > 0);
      
      // Выполняем каждую команду отдельно
      for (const sqlCommand of sqlCommands) {
        await executeQuery(sqlCommand + ';');
      }
    }
    
    console.log('✅ Миграции успешно выполнены');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграций:', error);
    throw error;
  }
}; 