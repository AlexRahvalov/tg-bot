-- Скрипт для подтверждения заявки через консоль
-- Замените APPLICATION_ID на ID нужной заявки

-- 1. Посмотреть все активные заявки (на рассмотрении и на голосовании)
SELECT 
    a.id,
    a.minecraft_nickname,
    a.reason,
    a.status,
    a.created_at,
    u.nickname as user_nickname,
    u.telegram_id
FROM applications a
JOIN users u ON a.user_id = u.id
WHERE a.status IN ('pending', 'voting')
ORDER BY a.created_at DESC;

-- 2. Подтвердить заявку (замените 1 на нужный ID заявки)
-- UPDATE applications SET status = 'approved' WHERE id = 1;

-- 3. Обновить роль пользователя на 'member' после подтверждения заявки
-- UPDATE users SET role = 'member', can_vote = TRUE WHERE id = (SELECT user_id FROM applications WHERE id = 1);

-- Полный скрипт для подтверждения заявки с ID = 1:
-- START TRANSACTION;
-- UPDATE applications SET status = 'approved' WHERE id = 1;
-- UPDATE users SET role = 'member', can_vote = TRUE WHERE id = (SELECT user_id FROM applications WHERE id = 1);
-- COMMIT;

-- Для отклонения заявки:
-- UPDATE applications SET status = 'rejected' WHERE id = 1;