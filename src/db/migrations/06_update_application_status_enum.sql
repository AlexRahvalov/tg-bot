-- Миграция для обновления ENUM-типа столбца status в таблице applications
-- Добавляем значения 'voting' и 'expired' в список допустимых значений

ALTER TABLE applications 
MODIFY COLUMN status ENUM('pending', 'voting', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending'; 