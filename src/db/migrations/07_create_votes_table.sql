-- Миграция для создания таблицы votes
-- Таблица необходима для хранения голосов за заявки

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