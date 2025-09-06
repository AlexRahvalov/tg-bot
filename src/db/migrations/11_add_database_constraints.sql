-- Миграция для добавления ограничений базы данных для обеспечения консистентности
-- Добавляем индексы и ограничения для повышения производительности и надежности

-- Добавляем составной индекс для быстрого поиска голосов по заявке и пользователю
CREATE INDEX IF NOT EXISTS idx_votes_application_voter ON votes(application_id, voter_id);

-- Добавляем индекс для быстрого подсчета голосов по типу
CREATE INDEX IF NOT EXISTS idx_votes_application_type ON votes(application_id, vote_type);

-- Добавляем индекс для поиска заявок по статусу и времени окончания голосования
CREATE INDEX IF NOT EXISTS idx_applications_status_voting_ends ON applications(status, voting_ends_at);

-- Добавляем индекс для счетчиков голосов
CREATE INDEX IF NOT EXISTS idx_applications_vote_counts ON applications(positive_votes, negative_votes);

-- Удаляем существующие ограничения если они есть
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_positive_votes_non_negative;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_negative_votes_non_negative;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_valid_user_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role_valid;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_valid_application_status;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_application_status_valid;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_future_voting_end_time;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_voting_ends_at_future;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS chk_valid_vote_type;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS chk_vote_type_valid;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS chk_vote_type_enum;

-- Добавляем ограничение для проверки корректности счетчиков голосов (не отрицательные)
ALTER TABLE applications 
ADD CONSTRAINT chk_positive_votes_non_negative 
CHECK (positive_votes >= 0);

ALTER TABLE applications 
ADD CONSTRAINT chk_negative_votes_non_negative 
CHECK (negative_votes >= 0);

-- Добавляем ограничение для проверки корректности времени окончания голосования
ALTER TABLE applications 
ADD CONSTRAINT chk_voting_ends_at_future 
CHECK (voting_ends_at IS NULL OR voting_ends_at > created_at);

-- Добавляем индекс для пользователей с правом голоса
CREATE INDEX IF NOT EXISTS idx_users_can_vote ON users(can_vote);

-- Добавляем индекс для статуса заявок
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Добавляем составной индекс для голосов по заявке и пользователю
CREATE INDEX IF NOT EXISTS idx_votes_app_user ON votes(application_id, voter_id);

-- Добавляем индекс для счетчиков голосов
CREATE INDEX IF NOT EXISTS idx_applications_vote_counts ON applications(positive_votes, negative_votes);

-- Добавляем индекс для времени окончания голосования
CREATE INDEX IF NOT EXISTS idx_applications_voting_ends_at ON applications(voting_ends_at);

-- Добавляем индекс для типа голоса
CREATE INDEX IF NOT EXISTS idx_votes_type ON votes(vote_type);

-- Добавляем ограничение для проверки корректности роли пользователя
ALTER TABLE users 
ADD CONSTRAINT chk_user_role_valid 
CHECK (role IN ('applicant', 'member', 'admin'));

-- Добавляем ограничение для проверки корректности статуса заявки
ALTER TABLE applications 
ADD CONSTRAINT chk_application_status_valid 
CHECK (status IN ('pending', 'voting', 'approved', 'rejected', 'expired'));

-- Добавляем ограничение для проверки корректности типа голоса
ALTER TABLE votes 
ADD CONSTRAINT chk_vote_type_valid 
CHECK (vote_type IN ('POSITIVE', 'NEGATIVE'));