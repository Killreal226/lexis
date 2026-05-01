package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/Killreal226/lexis/backend/internal/model"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrEmailTaken   = errors.New("email already taken")
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(
	ctx context.Context, email string, passwordHash string,
) (model.User, error) {
	query := `
	INSERT INTO users (email, password_hash)
	VALUES ($1, $2)
	RETURNING id, email, password_hash, is_superuser, created_at
	`
	var user model.User
	if err := r.db.QueryRowContext(ctx, query, email, passwordHash).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.IsSuperuser,
		&user.CreatedAt,
	); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return model.User{}, ErrEmailTaken
		}
		return model.User{}, err
	}
	return user, nil
}

func (r *UserRepository) GetByEmail(
	ctx context.Context, email string,
) (model.User, error) {
	query := `
	SELECT id, email, password_hash, is_superuser, created_at
	FROM users
	WHERE email = $1
	`
	var user model.User
	if err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.IsSuperuser,
		&user.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, err
	}
	return user, nil
}

func (r *UserRepository) GetByID(
	ctx context.Context, id int64,
) (model.User, error) {
	query := `
	SELECT id, email, password_hash, is_superuser, created_at
	FROM users
	WHERE id = $1
	`
	var user model.User
	if err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.IsSuperuser,
		&user.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, err
	}
	return user, nil
}
