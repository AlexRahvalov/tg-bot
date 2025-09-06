-- Обновление whitelist_status для пользователей с minecraft_uuid
-- Эта миграция выполняется после добавления поля minecraft_uuid

-- Обновляем пользователей с ролью 'member' и заполненным minecraft_uuid на статус 'not_added'
UPDATE users 
SET whitelist_status = 'not_added' 
WHERE role = 'member' 
  AND minecraft_uuid IS NOT NULL 
  AND minecraft_uuid != '' 
  AND (whitelist_status IS NULL OR whitelist_status = 'not_added');

-- Логируем количество обновленных записей
SELECT 
  COUNT(*) as updated_users,
  'Обновлены пользователи с minecraft_uuid' as message
FROM users 
WHERE role = 'member' 
  AND minecraft_uuid IS NOT NULL 
  AND minecraft_uuid != '' 
  AND whitelist_status = 'not_added';