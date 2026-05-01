MIGRATIONS_DIR := ./migrations
SWAGGER_DIR    := ./docs
SWAGGER_ENTRY  := cmd/server/main.go

ifneq (,$(wildcard ./.env))
    include .env
    export
endif

DB_DSN := host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=$(DB_SSLMODE)

.PHONY: migrate-up migrate-down migrate-status migrate-reset migrate-create seed-dev seed-reset swagger run

migrate-up:
	goose -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" up

migrate-down:
	goose -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" down

migrate-status:
	goose -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" status

migrate-reset:
	goose -dir $(MIGRATIONS_DIR) postgres "$(DB_DSN)" reset

migrate-create:
	@test -n "$(name)" || (echo "usage: make migrate-create name=add_something" && exit 1)
	goose -dir $(MIGRATIONS_DIR) create $(name) sql

seed-dev:
	psql "$(DB_DSN)" -f ./seeds/dev.sql

seed-reset: migrate-reset migrate-up seed-dev
	@echo "Database reset and seeded."

swagger:
	swag init -g $(SWAGGER_ENTRY) -o $(SWAGGER_DIR)

run:
	go run ./cmd/server