-- Добавление индексов для оптимизации производительности

-- Индекс для поиска активных заявок пользователя (используется в create методе)
CREATE INDEX IF NOT EXISTS idx_applications_user_active_status 
ON applications (user_id, status);

-- Индекс для поиска голосов по заявке и пользователю (используется в getUserVote)
CREATE INDEX IF NOT EXISTS idx_votes_application_voter 
ON votes (application_id, voter_id);

-- Индекс для сортировки голосов по времени создания
CREATE INDEX IF NOT EXISTS idx_votes_created_at 
ON votes (created_at DESC);

-- Индекс для поиска заявок по статусу и времени окончания голосования
CREATE INDEX IF NOT EXISTS idx_applications_status_voting_ends 
ON applications (status, voting_ends_at);

-- Индекс для поиска заявок по пользователю и времени создания
CREATE INDEX IF NOT EXISTS idx_applications_user_created 
ON applications (user_id, created_at DESC);

-- Составной индекс для оптимизации подсчета голосов
CREATE INDEX IF NOT EXISTS idx_votes_app_type_created 
ON votes (application_id, vote_type, created_at);