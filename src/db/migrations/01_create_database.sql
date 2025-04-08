-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(255),
    nickname VARCHAR(255) NOT NULL DEFAULT '',
    minecraft_nickname VARCHAR(255),
    minecraft_uuid VARCHAR(36),
    role ENUM('applicant', 'member', 'admin') NOT NULL DEFAULT 'applicant',
    can_vote BOOLEAN NOT NULL DEFAULT FALSE,
    reputation INT NOT NULL DEFAULT 0,
    total_ratings_given INT NOT NULL DEFAULT 0,
    last_rating_given TIMESTAMP NULL,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bio TEXT,
    positive_ratings_received INT DEFAULT 0,
    negative_ratings_received INT DEFAULT 0,
    total_ratings_received INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание таблицы голосований за заявки
CREATE TABLE IF NOT EXISTS application_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    user_id INT NOT NULL,
    vote ENUM('positive', 'negative') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (application_id, user_id)
);

-- Создание таблицы для хранения голосов (используется в VoteRepository)
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    voter_id INT NOT NULL,
    vote_type ENUM('POSITIVE', 'NEGATIVE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (application_id, voter_id)
);

-- Создание таблицы вопросов к заявкам
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

-- Создание таблицы оценок пользователей
CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rater_id INT NOT NULL,
    target_user_id INT NOT NULL,
    is_positive BOOLEAN NOT NULL,
    reason TEXT,
    cooldown_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание таблицы системных настроек
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_join_date ON users(join_date);
CREATE INDEX IF NOT EXISTS idx_users_ratings ON users(positive_ratings_received, negative_ratings_received);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_target_user_id ON ratings(target_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_cooldown ON ratings(cooldown_until);

-- Вставка начальных системных настроек
INSERT INTO system_settings (key_name, value, description) VALUES
('voting_duration_days', '0', 'Длительность голосования в днях'),
('voting_duration_hours', '0', 'Длительность голосования в часах'),
('voting_duration_minutes', '2', 'Длительность голосования в минутах'),
('min_votes_required', '1', 'Минимальное количество голосов для принятия решения'),
('rating_cooldown_minutes', '60', 'Время ожидания между оценками в минутах'),
('max_daily_ratings', '10', 'Максимальное количество оценок в день'),
('min_reputation_for_voting', '-5', 'Минимальная репутация для возможности голосования'),
('negative_ratings_threshold', '1', 'Порог негативных оценок для автоматического исключения')
ON DUPLICATE KEY UPDATE value = VALUES(value); 