-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  minecraft_nickname VARCHAR(255) NOT NULL,
  minecraft_uuid VARCHAR(36),
  role ENUM('applicant', 'member', 'admin') NOT NULL DEFAULT 'applicant',
  can_vote BOOLEAN NOT NULL DEFAULT FALSE,
  reputation INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_telegram_id (telegram_id),
  INDEX idx_minecraft_nickname (minecraft_nickname)
);

-- Создание таблицы заявок
CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  minecraft_nickname VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'voting', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  voting_ends_at TIMESTAMP NULL,
  positive_votes INT NOT NULL DEFAULT 0,
  negative_votes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_voting_ends_at (voting_ends_at)
);

-- Создание таблицы голосов
CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  voter_id INT NOT NULL,
  vote_type ENUM('positive', 'negative') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_vote (application_id, voter_id)
);

-- Создание таблицы вопросов
CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  asker_id INT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT,
  answered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (asker_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание таблицы оценок
CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_user_id INT NOT NULL,
  rater_id INT NOT NULL,
  is_positive BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rating (target_user_id, rater_id)
);

-- Создание таблицы настроек
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voting_duration_hours INT NOT NULL DEFAULT 24,
  min_votes_required INT NOT NULL DEFAULT 3,
  negative_ratings_threshold INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Вставка начальных настроек, если таблица пуста
INSERT INTO system_settings (voting_duration_hours, min_votes_required, negative_ratings_threshold)
SELECT 24, 3, 5
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_settings); 