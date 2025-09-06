-- Триггер для автоматического обновления счетчиков при добавлении голоса
CREATE TRIGGER votes_after_insert
    AFTER INSERT ON votes
    FOR EACH ROW
    UPDATE applications 
    SET positive_votes = CASE 
        WHEN NEW.vote_type = 'POSITIVE' THEN positive_votes + 1 
        ELSE positive_votes 
    END,
    negative_votes = CASE 
        WHEN NEW.vote_type = 'NEGATIVE' THEN negative_votes + 1 
        ELSE negative_votes 
    END
    WHERE id = NEW.application_id;