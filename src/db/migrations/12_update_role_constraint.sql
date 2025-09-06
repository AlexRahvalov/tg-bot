-- Обновление ограничения роли пользователя для поддержки роли VISITOR
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role_valid;

-- Добавляем обновленное ограничение с поддержкой роли visitor
ALTER TABLE users 
ADD CONSTRAINT chk_user_role_valid 
CHECK (role IN ('visitor', 'applicant', 'member', 'admin'));