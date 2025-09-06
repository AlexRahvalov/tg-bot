import { createConnection, createPool } from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import config from '../config/env';

/**
 * Пул соединений с базой данных
 */
let pool: Pool;

/**
 * Инициализация пула соединений с базой данных
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database connection...');
    
    // Сначала создаем подключение для проверки и создания базы данных
    const tempConn = await createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      ssl: false,
      charset: 'utf8mb4',
      connectTimeout: 10000,
      socketTimeout: 10000
    });

    // Проверяем существование базы данных
    try {
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
      console.log(`Database '${config.db.database}' ensured to exist.`);
    } finally {
      await tempConn.end();
    }

    // Теперь создаем основной пул с указанием базы данных
    pool = createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionLimit: 10,
      acquireTimeout: 30000,
      queryTimeout: 30000,
      multipleStatements: true,
      ssl: false,
      charset: 'utf8mb4',
      connectTimeout: 10000,
      socketTimeout: 10000,
      idleTimeout: 300000
    });

    // Проверяем соединение с базой данных
    const connection = await pool.getConnection();
    console.log('✅ Database connection established successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

/**
 * Получение соединения из пула
 */
export const getConnection = async (): Promise<PoolConnection> => {
  if (!pool) {
    await initializeDatabase();
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
    console.log('✅ Database connection closed');
  }
};

export { pool };