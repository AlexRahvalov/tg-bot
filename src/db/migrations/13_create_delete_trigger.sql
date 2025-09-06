-- Триггер для автоматического обновления счетчиков при удалении голоса
CREATE TRIGGER votes_after_delete
    AFTER DELETE ON votes
    FOR EACH ROW
    UPDATE applications 
    SET positive_votes = CASE 
        WHEN OLD.vote_type = 'POSITIVE' THEN GREATEST(0, positive_votes - 1) 
        ELSE positive_votes 
    END,
    negative_votes = CASE 
        WHEN OLD.vote_type = 'NEGATIVE' THEN GREATEST(0, negative_votes - 1) 
        ELSE negative_votes 
    END
    WHERE id = OLD.application_id;