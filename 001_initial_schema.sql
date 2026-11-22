-- TaskFlow: первоначальное создание схемы PostgreSQL
-- Создаёт типы перечислений и все таблицы, описанные в app/models.py.
-- Скрипт не удаляет и не очищает существующие данные.
-- Запускать из корня репозитория через psql (инструкция приведена отдельно).

BEGIN;

-- В моделях SQLAlchemy для перечислений указаны create_type=False,
-- поэтому типы PostgreSQL создаём явно.
DO $$
BEGIN
    CREATE TYPE "AccountType" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE "ProjectRole" AS ENUM ('LEADER', 'MEMBER', 'OBSERVER');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE "TaskStatus" AS ENUM (
        'NEW', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'POSTPONED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    avatar VARCHAR NULL,
    account_type "AccountType" NOT NULL,
    is_teacher_verified BOOLEAN NOT NULL,
    email_verified BOOLEAN NOT NULL,
    is_blocked BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR NOT NULL UNIQUE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    user_agent VARCHAR NULL,
    ip_address VARCHAR NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_date TIMESTAMP WITHOUT TIME ZONE NULL,
    end_date TIMESTAMP WITHOUT TIME ZONE NULL,
    status "ProjectStatus" NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS project_memberships (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role "ProjectRole" NOT NULL,
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uq_project_memberships_project_id_user_id UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignee_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    status "TaskStatus" NOT NULL,
    priority "TaskPriority" NOT NULL,
    position INTEGER NOT NULL,
    start_date TIMESTAMP WITHOUT TIME ZONE NULL,
    deadline TIMESTAMP WITHOUT TIME ZONE NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE TABLE IF NOT EXISTS labels (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    color VARCHAR NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uq_labels_project_id_name UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS ix_comments_task_created
    ON comments (task_id, created_at);

CREATE INDEX IF NOT EXISTS ix_comments_author
    ON comments (author_id);

CREATE INDEX IF NOT EXISTS ix_comments_active_task
    ON comments (task_id)
    WHERE deleted_at IS NULL;

COMMIT;
