-- Миграция для добавления поля is_positive в таблицу ratings
-- Поле необходимо для хранения типа оценки (положительная/отрицательная)

-- Проверяем, существует ли уже столбец is_positive
SET @exist := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ratings'
    AND COLUMN_NAME = 'is_positive'
);

-- Если столбец не существует, добавляем его
SET @query = IF(@exist = 0,
    'ALTER TABLE ratings ADD COLUMN is_positive BOOLEAN NOT NULL DEFAULT TRUE COMMENT "Положительная ли оценка (TRUE - положительная, FALSE - отрицательная)"',
    'SELECT "Столбец is_positive уже существует"'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Если поле было добавлено, мигрируем данные из поля value
-- Предполагаем, что положительные значения value означают положительную оценку
SET @migrate_query = IF(@exist = 0,
    'UPDATE ratings SET is_positive = CASE WHEN value > 0 THEN TRUE ELSE FALSE END',
    'SELECT "Миграция данных не требуется"'
);

PREPARE migrate_stmt FROM @migrate_query;
EXECUTE migrate_stmt;
DEALLOCATE PREPARE migrate_stmt;