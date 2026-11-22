-- Этап 6. Таблица комментариев к задачам.
-- Модель Comment уже описана в app/models.py; миграция нужна только если
-- таблица comments ещё не была создана в существующей базе данных.

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL
);

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS ix_comments_task_created
    ON comments (task_id, created_at);

CREATE INDEX IF NOT EXISTS ix_comments_author
    ON comments (author_id);

CREATE INDEX IF NOT EXISTS ix_comments_active_task
    ON comments (task_id)
    WHERE deleted_at IS NULL;
