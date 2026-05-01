#!/bin/sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=5432}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_SSLMODE:=disable}"
: "${MIGRATIONS_DIR:=/app/migrations}"
: "${SEEDS_FILE:=/app/seeds/dev.sql}"
: "${RUN_SEEDS:=false}"

DSN="host=${DB_HOST} port=${DB_PORT} user=${DB_USER} password=${DB_PASSWORD} dbname=${DB_NAME} sslmode=${DB_SSLMODE}"

echo "[backend] waiting for postgres at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 60); do
    if goose -dir "${MIGRATIONS_DIR}" postgres "${DSN}" status >/dev/null 2>&1; then
        echo "[backend] postgres is reachable"
        break
    fi
    if [ "$i" = "60" ]; then
        echo "[backend] postgres did not become ready in time" >&2
        exit 1
    fi
    sleep 1
done

echo "[backend] applying migrations..."
goose -dir "${MIGRATIONS_DIR}" postgres "${DSN}" up

if [ "${RUN_SEEDS}" = "true" ] && [ -f "${SEEDS_FILE}" ]; then
    echo "[backend] applying dev seeds from ${SEEDS_FILE}..."
    PGURL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}"
    if command -v psql >/dev/null 2>&1; then
        psql "${PGURL}" -f "${SEEDS_FILE}"
    else
        echo "[backend] psql not installed in runtime image, skipping seeds" >&2
    fi
fi

echo "[backend] starting: $*"
exec "$@"
