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
    // Сначала создаем пул для подключения без указания базы данных
    const tempPool = createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      connectionLimit: 1
    });

    // Проверяем, существует ли база данных, и создаем её при необходимости
    const tempConnection = await tempPool.getConnection();
    try {
      console.log(`⏳ Проверка существования базы данных ${config.db.database}...`);
      
      // Проверяем существование базы данных
      const dbExists = await tempConnection.query(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [config.db.database]
      );
      
      if (dbExists.length === 0) {
        console.log(`⏳ База данных ${config.db.database} не существует, создаем...`);
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database};`);
        console.log(`✅ База данных ${config.db.database} успешно создана`);
      } else {
        console.log(`✅ База данных ${config.db.database} уже существует`);
      }
    } finally {
      // Закрываем временное соединение
      tempConnection.release();
      await tempPool.end();
    }

    // Теперь создаем основной пул с указанием базы данных
    pool = createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionLimit: 5,
      multipleStatements: true,
    });

    // Проверяем соединение с базой данных
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