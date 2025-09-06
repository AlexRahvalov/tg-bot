-- Миграция для добавления столбцов подсчета голосов в таблицу applications
-- Необходимо для хранения количества положительных и отрицательных голосов

-- Проверяем, существует ли уже столбец positive_votes
SET @exist_positive := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'applications'
    AND COLUMN_NAME = 'positive_votes'
);

-- Проверяем, существует ли уже столбец negative_votes
SET @exist_negative := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'applications'
    AND COLUMN_NAME = 'negative_votes'
);

-- Если столбцы не существуют, добавляем их
SET @query_positive = IF(@exist_positive = 0,
    'ALTER TABLE applications ADD COLUMN positive_votes INT NOT NULL DEFAULT 0',
    'SELECT "Столбец positive_votes уже существует"'
);

SET @query_negative = IF(@exist_negative = 0,
    'ALTER TABLE applications ADD COLUMN negative_votes INT NOT NULL DEFAULT 0',
    'SELECT "Столбец negative_votes уже существует"'
);

PREPARE stmt_positive FROM @query_positive;
EXECUTE stmt_positive;
DEALLOCATE PREPARE stmt_positive;

PREPARE stmt_negative FROM @query_negative;
EXECUTE stmt_negative;
DEALLOCATE PREPARE stmt_negative; 