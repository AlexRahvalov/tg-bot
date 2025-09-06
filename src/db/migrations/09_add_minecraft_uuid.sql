-- Миграция для добавления столбца minecraft_uuid в таблицу users
-- Необходим для хранения UUID игрока Minecraft

-- Проверяем, существует ли уже столбец minecraft_uuid
SET @exist := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'minecraft_uuid'
);

-- Если столбец не существует, добавляем его
SET @query = IF(@exist = 0,
    'ALTER TABLE users ADD COLUMN minecraft_uuid VARCHAR(36) DEFAULT NULL',
    'SELECT "Столбец minecraft_uuid уже существует"'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 