package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Killreal226/lexis/backend/internal/middleware"
	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/service"
)

type AuthHandler struct {
	service *service.AuthService
}

func NewAuthHandler(s *service.AuthService) *AuthHandler {
	return &AuthHandler{service: s}
}

type RegisterRequest struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"superSecret123"`
}

type LoginRequest struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"superSecret123"`
}

type AuthResponse struct {
	User  model.User `json:"user"`
	Token string     `json:"access_token"`
}

type MeResponse struct {
	User model.User `json:"user"`
}

type ErrorResponse struct {
	Error string `json:"error" example:"invalid request body"`
}

// Register godoc
// @Summary      Регистрация нового пользователя
// @Description  Создаёт нового пользователя и сразу выдаёт access-токен.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      RegisterRequest  true  "Email и пароль"
// @Success      201   {object}  AuthResponse
// @Failure      400   {object}  ErrorResponse  "невалидное тело / email / пароль"
// @Failure      409   {object}  ErrorResponse  "email уже занят"
// @Failure      500   {object}  ErrorResponse
// @Router       /auth/register [post]
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	user, token, err := h.service.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, AuthResponse{User: user, Token: token})
}

// Login godoc
// @Summary      Вход по email и паролю
// @Description  Проверяет учётные данные и возвращает access-токен.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      LoginRequest  true  "Email и пароль"
// @Success      200   {object}  AuthResponse
// @Failure      400   {object}  ErrorResponse  "невалидное тело"
// @Failure      401   {object}  ErrorResponse  "неверный email или пароль"
// @Failure      500   {object}  ErrorResponse
// @Router       /auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	user, token, err := h.service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, AuthResponse{User: user, Token: token})
}

// Logout godoc
// @Summary      Выход
// @Description  JWT stateless: сервер токен не хранит — клиент удаляет access_token. Ответ 204 для единообразия с контрактом API.
// @Tags         auth
// @Success      204  "нет тела"
// @Router       /auth/logout [post]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

// Me godoc
// @Summary      Текущий пользователь
// @Description  Возвращает данные пользователя по access-токену из заголовка Authorization.
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  MeResponse
// @Failure      401  {object}  ErrorResponse  "нет/битый/просроченный токен"
// @Failure      404  {object}  ErrorResponse  "пользователь не найден"
// @Failure      500  {object}  ErrorResponse
// @Router       /auth/me [get]
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	user, err := h.service.Me(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MeResponse{User: user})
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidEmail),
		errors.Is(err, service.ErrWeakPassword):
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case errors.Is(err, service.ErrEmailTaken):
		writeJSON(w, http.StatusConflict, ErrorResponse{Error: err.Error()})
	case errors.Is(err, service.ErrInvalidCredentials),
		errors.Is(err, service.ErrInvalidToken):
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: err.Error()})
	case errors.Is(err, service.ErrUserNotFound):
		writeJSON(w, http.StatusNotFound, ErrorResponse{Error: err.Error()})
	default:
		log.Printf("auth handler: %v", err)
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "internal server error"})
	}
}
