-- Добавление роли VISITOR в ENUM и изменение значения по умолчанию
ALTER TABLE users MODIFY COLUMN role ENUM('visitor', 'applicant', 'member', 'admin') NOT NULL DEFAULT 'visitor';