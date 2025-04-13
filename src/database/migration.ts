import { pool } from './connection';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

/**
 * SQL-запросы для создания таблиц
 */
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    telegramId BIGINT NOT NULL,
    username VARCHAR(255),
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255),
    minecraftUsername VARCHAR(255),
    minecraftUUID VARCHAR(255),
    role ENUM('new', 'guest', 'member', 'admin') NOT NULL DEFAULT 'new',
    canVote BOOLEAN NOT NULL DEFAULT FALSE,
    reputation_positive FLOAT NOT NULL DEFAULT 0,
    reputation_negative FLOAT NOT NULL DEFAULT 0,
    reputation_last_reset DATETIME,
    created DATETIME NOT NULL,
    updated DATETIME,
    PRIMARY KEY (id),
    UNIQUE KEY (telegramId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS applications (
    id INT NOT NULL AUTO_INCREMENT,
    userId INT NOT NULL,
    telegramId BIGINT NOT NULL,
    minecraftUsername VARCHAR(255) NOT NULL,
    minecraftUUID VARCHAR(255),
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'expired', 'banned') NOT NULL DEFAULT 'pending',
    votingEndsAt DATETIME NOT NULL,
    votesPositive INT NOT NULL DEFAULT 0,
    votesNegative INT NOT NULL DEFAULT 0,
    created DATETIME NOT NULL,
    updated DATETIME,
    PRIMARY KEY (id),
    KEY (userId),
    KEY (telegramId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS votes (
    id INT NOT NULL AUTO_INCREMENT,
    applicationId INT NOT NULL,
    userId INT NOT NULL,
    voteType ENUM('positive', 'negative') NOT NULL,
    created DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY (applicationId, userId),
    FOREIGN KEY (applicationId) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS questions (
    id INT NOT NULL AUTO_INCREMENT,
    applicationId INT NOT NULL,
    fromUserId INT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    answeredAt DATETIME,
    created DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY (applicationId),
    FOREIGN KEY (applicationId) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (fromUserId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS reputation_reasons (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_positive BOOLEAN NOT NULL DEFAULT TRUE,
    created DATETIME NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS user_reputation_records (
    id INT NOT NULL AUTO_INCREMENT,
    voter_id INT NOT NULL,
    target_id INT NOT NULL,
    is_positive BOOLEAN NOT NULL,
    reason_id INT,
    vote_weight FLOAT DEFAULT 1.0,
    created DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY (voter_id),
    KEY (target_id),
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reason_id) REFERENCES reputation_reasons(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
];

// Запросы для обновления ролей пользователей
const UPDATE_ROLES = [
  // Изменение структуры таблицы для поддержки новой роли GUEST
  `ALTER TABLE users MODIFY COLUMN role ENUM('new', 'guest', 'member', 'admin') NOT NULL DEFAULT 'new'`,
  
  // Установка роли GUEST для пользователей, у которых есть активные заявки
  `UPDATE users u
  JOIN applications a ON u.telegramId = a.telegramId
  SET u.role = 'guest'
  WHERE a.status = 'pending' AND u.role = 'new'`,
  
  // Установка роли MEMBER для пользователей, у которых есть одобренные заявки
  `UPDATE users u
  JOIN applications a ON u.telegramId = a.telegramId
  SET u.role = 'member'
  WHERE a.status = 'approved' AND u.role IN ('new', 'guest')`
];

// Запросы для добавления полей репутации, если они отсутствуют
const UPDATE_REPUTATION_FIELDS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reputation_positive FLOAT NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reputation_negative FLOAT NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reputation_last_reset DATETIME`
];

// Запросы для добавления начальных причин репутации
const DEFAULT_REPUTATION_REASONS = [
  `INSERT INTO reputation_reasons (name, description, is_positive, created) 
   SELECT 'Нарушение правил сервера', 'Игрок нарушил правила, установленные на сервере', FALSE, NOW()
   WHERE NOT EXISTS (SELECT 1 FROM reputation_reasons WHERE name = 'Нарушение правил сервера')`,
   
  `INSERT INTO reputation_reasons (name, description, is_positive, created) 
   SELECT 'Гриферство', 'Игрок намеренно портил постройки или имущество других игроков', FALSE, NOW()
   WHERE NOT EXISTS (SELECT 1 FROM reputation_reasons WHERE name = 'Гриферство')`,
   
  `INSERT INTO reputation_reasons (name, description, is_positive, created) 
   SELECT 'Оскорбления/токсичное поведение', 'Игрок вел себя оскорбительно или токсично по отношению к другим', FALSE, NOW()
   WHERE NOT EXISTS (SELECT 1 FROM reputation_reasons WHERE name = 'Оскорбления/токсичное поведение')`,
   
  `INSERT INTO reputation_reasons (name, description, is_positive, created) 
   SELECT 'Помощь другим игрокам', 'Игрок оказывал помощь другим участникам сервера', TRUE, NOW()
   WHERE NOT EXISTS (SELECT 1 FROM reputation_reasons WHERE name = 'Помощь другим игрокам')`,
   
  `INSERT INTO reputation_reasons (name, description, is_positive, created) 
   SELECT 'Вклад в развитие сервера', 'Игрок внес значительный вклад в развитие сервера или сообщества', TRUE, NOW()
   WHERE NOT EXISTS (SELECT 1 FROM reputation_reasons WHERE name = 'Вклад в развитие сервера')`
];

/**
 * Функция для выполнения миграции базы данных
 */
async function runMigration(): Promise<void> {
  let connection;
  try {
    console.log('Начало миграции базы данных...');
    
    connection = await pool.getConnection();
    
    // Создание базы данных, если она не существует
    const dbName = process.env.DB_NAME || 'minecraft_bot';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    
    // Выбор базы данных
    await connection.query(`USE ${dbName};`);
    
    // Создание таблиц
    for (const query of CREATE_TABLES) {
      console.log('Выполнение запроса:', query.substring(0, 60) + '...');
      await connection.query(query);
    }
    
    // Создание первого администратора, если не существует
    if (process.env.ADMIN_TELEGRAM_ID) {
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      const adminExists = await connection.query('SELECT id FROM users WHERE telegramId = ?', [adminId]);
      
      if (adminExists.length === 0) {
        await connection.query(
          'INSERT INTO users (telegramId, firstName, role, canVote, created) VALUES (?, ?, ?, ?, ?)',
          [adminId, 'Admin', 'admin', true, new Date()]
        );
        console.log(`Администратор с Telegram ID ${adminId} создан.`);
      }
    }
    
    // Обновление ролей пользователей
    console.log('Обновление ролей пользователей...');
    for (const query of UPDATE_ROLES) {
      console.log('Выполнение запроса:', query.substring(0, 60) + '...');
      const result = await connection.query(query);
      console.log(`Обновлено ${result.affectedRows} пользователей`);
    }
    
    // Обновление полей репутации
    console.log('Обновление полей репутации...');
    for (const query of UPDATE_REPUTATION_FIELDS) {
      console.log('Выполнение запроса:', query.substring(0, 60) + '...');
      await connection.query(query);
    }
    
    // Добавление начальных причин репутации
    console.log('Добавление начальных причин репутации...');
    for (const query of DEFAULT_REPUTATION_REASONS) {
      console.log('Выполнение запроса:', query.substring(0, 60) + '...');
      await connection.query(query);
    }
    
    console.log('Миграция успешно завершена.');
  } catch (error) {
    console.error('Ошибка при выполнении миграции:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Запуск миграции при непосредственном выполнении файла
 */
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Критическая ошибка при выполнении миграции:', error);
      process.exit(1);
    });
}

export { runMigration }; 