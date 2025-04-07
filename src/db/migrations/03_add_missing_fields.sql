-- Добавление отсутствующих полей в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS positive_ratings_received INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS negative_ratings_received INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ratings_received INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reputation INT DEFAULT 0;

-- Обновление значений полей для существующих пользователей
UPDATE users SET 
  reputation = 0,
  positive_ratings_received = 0,
  negative_ratings_received = 0,
  total_ratings_received = 0
WHERE reputation IS NULL OR positive_ratings_received IS NULL OR negative_ratings_received IS NULL OR total_ratings_received IS NULL; 