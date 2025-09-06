-- Удаляем существующие триггеры если они есть
DROP TRIGGER IF EXISTS votes_after_insert;
DROP TRIGGER IF EXISTS votes_after_delete;
DROP TRIGGER IF EXISTS votes_after_update;

-- Пересчитываем существующие счетчики для обеспечения консистентности
UPDATE applications a 
SET 
    positive_votes = (
        SELECT COUNT(*) 
        FROM votes v 
        WHERE v.application_id = a.id AND v.vote_type = 'POSITIVE'
    ),
    negative_votes = (
        SELECT COUNT(*) 
        FROM votes v 
        WHERE v.application_id = a.id AND v.vote_type = 'NEGATIVE'
    );