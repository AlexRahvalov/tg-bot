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
      
      // Чтение SQL-скрипта
      const sqlPath = join(__dirname, sqlFile);
      const sql = await readFile(sqlPath, 'utf8');
      
      try {
        // Выполняем весь скрипт целиком
        await executeQuery(sql);
        console.log(`✅ Миграция ${sqlFile} успешно выполнена`);
      } catch (error) {
        console.error(`❌ Ошибка при выполнении миграции ${sqlFile}:`, error);
        
        // Если произошла ошибка, попробуем выполнить команды по отдельности
        console.log(`⏳ Пробуем выполнить команды из ${sqlFile} по отдельности...`);
        
        // Разделяем SQL на отдельные команды
        const sqlCommands = sql
          .split(';')
          .map(command => command.trim())
          .filter(command => command.length > 0);
        
        for (const sqlCommand of sqlCommands) {
          try {
            await executeQuery(sqlCommand);
          } catch (cmdError) {
            console.error(`❌ Ошибка в SQL команде: ${sqlCommand}`, cmdError);
            throw cmdError;
          }
        }
      }
    }
    
    console.log('✅ Миграции успешно выполнены');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграций:', error);
    throw error;
  }
}; 