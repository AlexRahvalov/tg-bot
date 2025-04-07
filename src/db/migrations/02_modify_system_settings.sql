-- Добавление колонок, если они еще не существуют
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS voting_duration_days INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS voting_duration_minutes INT NOT NULL DEFAULT 0;

-- Миграция данных из старого поля
UPDATE system_settings
SET 
  voting_duration_days = FLOOR(voting_duration_hours / 24),
  voting_duration_hours = voting_duration_hours % 24,
  voting_duration_minutes = 0
WHERE 1=1;

-- Пока не удаляем старое поле для обратной совместимости
-- После полного тестирования можно будет создать отдельную миграцию для удаления
-- ALTER TABLE system_settings DROP COLUMN voting_duration_hours; 