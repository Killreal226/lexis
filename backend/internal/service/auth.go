package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/repository"
)

const (
	minEmailLength    = 5
	minPasswordLength = 8
)

var (
	ErrInvalidEmail       = errors.New("invalid email")
	ErrWeakPassword       = errors.New("password is too short")
	ErrEmailTaken         = errors.New("email already taken")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid token")
)

type AccessClaims struct {
	Email       string `json:"email"`
	IsSuperuser bool   `json:"is_superuser"`
	jwt.RegisteredClaims
}

type AuthRepository interface {
	Create(
		ctx context.Context, email string, passwordHash string,
	) (model.User, error)
	GetByEmail(
		ctx context.Context, email string,
	) (model.User, error)
	GetByID(
		ctx context.Context, id int64,
	) (model.User, error)
}

type AuthService struct {
	repo      AuthRepository
	jwtSecret []byte
	accessTTL time.Duration
}

func NewAuthService(
	repo AuthRepository, jwtSecret string, accessTTL time.Duration,
) *AuthService {
	return &AuthService{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
		accessTTL: accessTTL,
	}
}

func (s *AuthService) Register(
	ctx context.Context, email string, password string,
) (model.User, string, error) {
	email = normalizeEmail(email)
	if len(email) < minEmailLength || !strings.Contains(email, "@") {
		return model.User{}, "", ErrInvalidEmail
	}
	if len(password) < minPasswordLength {
		return model.User{}, "", ErrWeakPassword
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return model.User{}, "", fmt.Errorf("hash password: %w", err)
	}

	user, err := s.repo.Create(ctx, email, passwordHash)
	if err != nil {
		if errors.Is(err, repository.ErrEmailTaken) {
			return model.User{}, "", ErrEmailTaken
		}
		return model.User{}, "", fmt.Errorf("create user: %w", err)
	}

	token, err := s.GenerateAccessToken(user)
	if err != nil {
		return model.User{}, "", fmt.Errorf("generate access token: %w", err)
	}
	return user, token, nil
}

func (s *AuthService) Login(
	ctx context.Context, email string, password string,
) (model.User, string, error) {
	email = normalizeEmail(email)

	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return model.User{}, "", ErrInvalidCredentials
		}
		return model.User{}, "", fmt.Errorf("get user by email: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash), []byte(password),
	); err != nil {
		return model.User{}, "", ErrInvalidCredentials
	}
	token, err := s.GenerateAccessToken(user)
	if err != nil {
		return model.User{}, "", fmt.Errorf("generate access token: %w", err)
	}
	return user, token, nil
}

func (s *AuthService) Me(ctx context.Context, userID int64) (model.User, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (s *AuthService) GenerateAccessToken(user model.User) (string, error) {
	now := time.Now()
	isSuper := false
	if user.IsSuperuser != nil {
		isSuper = *user.IsSuperuser
	}
	claims := AccessClaims{
		Email:       user.Email,
		IsSuperuser: isSuper,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(user.ID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) ParseAccessToken(token string) (AccessClaims, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(
		token, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return s.jwtSecret, nil
		},
	)
	if err != nil {
		return AccessClaims{}, ErrInvalidToken
	}
	return *claims, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}
