-- Создание таблицы вопросов к заявкам
CREATE TABLE IF NOT EXISTS questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  application_id INT NOT NULL,
  asker_id INT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT,
  answered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (asker_id) REFERENCES users(id) ON DELETE CASCADE
); 