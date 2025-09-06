-- Миграция для добавления поля voting_ends_at в таблицу applications
-- Данное поле необходимо для хранения времени окончания голосования за заявку

-- Проверяем, существует ли уже столбец voting_ends_at
SET @exist := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'applications'
    AND COLUMN_NAME = 'voting_ends_at'
);

-- Если столбец не существует, добавляем его
SET @query = IF(@exist = 0,
    'ALTER TABLE applications ADD COLUMN voting_ends_at DATETIME DEFAULT NULL COMMENT "Время окончания голосования за заявку"',
    'SELECT "Столбец voting_ends_at уже существует"'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 