-- Добавление поля whitelist_status в таблицу users (если не существует)
ALTER TABLE users ADD COLUMN IF NOT EXISTS whitelist_status ENUM('added', 'removed', 'not_added') DEFAULT 'not_added';

-- Обновляем существующих пользователей с ролью 'member' на статус 'not_added'
UPDATE users SET whitelist_status = 'not_added' WHERE role = 'member' AND minecraft_uuid IS NOT NULL AND minecraft_uuid != '' AND whitelist_status IS NULL;