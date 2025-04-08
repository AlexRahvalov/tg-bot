import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { executeQuery } from '../connection';
import { logger } from '../../utils/logger';

/**
 * Выполнение миграций базы данных
 */
export const runMigrations = async (): Promise<void> => {
  try {
    logger.info('📊 Запуск миграций базы данных...');
    
    // Получаем список всех файлов миграций
    const migrationFiles = await readdir(__dirname);
    
    // Фильтруем только SQL файлы и сортируем их по имени
    const sqlFiles = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Выполняем каждый файл миграции по очереди
    for (const sqlFile of sqlFiles) {
      logger.info(`⏳ Выполнение миграции: ${sqlFile}`);
      
      // Чтение SQL-скрипта
      const sqlPath = join(__dirname, sqlFile);
      const sql = await readFile(sqlPath, 'utf8');
      
      try {
        // Выполняем весь скрипт целиком
        await executeQuery(sql);
        logger.info(`✅ Миграция ${sqlFile} успешно выполнена`);
      } catch (error) {
        logger.error(`❌ Ошибка при выполнении миграции ${sqlFile}:`, error);
        
        // Если произошла ошибка, попробуем выполнить команды по отдельности
        logger.info(`⏳ Пробуем выполнить команды из ${sqlFile} по отдельности...`);
        
        // Разделяем SQL на отдельные команды
        const sqlCommands = sql
          .split(';')
          .map(command => command.trim())
          .filter(command => command.length > 0);
        
        for (const sqlCommand of sqlCommands) {
          try {
            await executeQuery(sqlCommand);
          } catch (cmdError) {
            logger.error(`❌ Ошибка в SQL команде: ${sqlCommand}`, cmdError);
            throw cmdError;
          }
        }
      }
    }
    
    logger.info('✅ Миграции успешно выполнены');
  } catch (error) {
    logger.error('❌ Ошибка при выполнении миграций:', error);
    throw error;
  }
}; 