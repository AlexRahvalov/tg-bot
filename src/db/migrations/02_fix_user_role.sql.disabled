-- Переименовываем столбец role для временного хранения
ALTER TABLE users CHANGE role old_role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Добавляем новый столбец role с правильным ENUM
ALTER TABLE users ADD COLUMN role ENUM('applicant', 'member', 'admin') NOT NULL DEFAULT 'applicant';

-- Обновляем значения в новом столбце на основе старых значений
UPDATE users SET role = 'member' WHERE old_role = 'user';
UPDATE users SET role = 'admin' WHERE old_role = 'admin';

-- Удаляем временный столбец
ALTER TABLE users DROP COLUMN old_role; 