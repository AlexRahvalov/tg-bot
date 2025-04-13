import mariadb from 'mariadb';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к базе данных
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'minecraft_bot',
  connectionLimit: 5
});

/**
 * Выполнение SQL-запроса к базе данных
 * @param query - SQL-запрос
 * @param params - Параметры запроса
 * @returns Результат запроса
 */
async function executeQuery<T>(query: string, params: any[] = []): Promise<T> {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.query(query, params);
    return result as T;
  } catch (error) {
    console.error('Ошибка при выполнении SQL-запроса:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export { pool, executeQuery }; 