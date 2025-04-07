import { createPool } from 'mariadb';
import type { Pool } from 'mariadb';
import config from '../config/env';

/**
 * Пул соединений с базой данных
 */
let pool: Pool;

/**
 * Инициализация пула соединений с базой данных
 */
export const initDatabase = async (): Promise<void> => {
  try {
    pool = createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionLimit: 5,
    });

    // Проверяем соединение
    const connection = await pool.getConnection();
    console.log('✅ Успешное подключение к базе данных');
    connection.release();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    throw error;
  }
};

/**
 * Получение соединения из пула
 */
export const getConnection = async () => {
  if (!pool) {
    await initDatabase();
  }
  return pool.getConnection();
};

/**
 * Выполнение SQL-запроса
 * @param query SQL-запрос
 * @param params Параметры запроса
 */
export const executeQuery = async (query: string, params: any[] = []): Promise<any> => {
  const connection = await getConnection();
  try {
    return await connection.query(query, params);
  } finally {
    connection.release();
  }
};

/**
 * Закрытие пула соединений при завершении работы приложения
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    console.log('✅ Соединение с базой данных закрыто');
  }
}; 