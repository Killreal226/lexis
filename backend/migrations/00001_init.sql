-- +goose Up

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
    id             BIGSERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    is_superuser   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE words (
    id           BIGSERIAL PRIMARY KEY,
    word         VARCHAR(100) NOT NULL,
    translation  VARCHAR(255) NOT NULL,
    example_en   TEXT NOT NULL,
    example_ru   TEXT,
    image_path   TEXT,
    created_by   BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE progress (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id           BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    direction         VARCHAR(5) NOT NULL,
    level             SMALLINT NOT NULL DEFAULT 0,
    last_reviewed_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, word_id, direction),
    CHECK (direction IN ('en_ru', 'ru_en')),
    CHECK (level BETWEEN 0 AND 20)
);

CREATE INDEX idx_progress_user_level_reviewed
    ON progress(user_id, level, last_reviewed_at);

-- +goose Down

DROP INDEX IF EXISTS idx_progress_user_level_reviewed;
DROP TABLE IF EXISTS progress;

DROP TABLE IF EXISTS words;

DROP TABLE IF EXISTS users;

DROP EXTENSION IF EXISTS pg_trgm;
