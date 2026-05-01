package router

import (
	"net/http"
	"path/filepath"

	httpSwagger "github.com/swaggo/http-swagger"

	_ "github.com/Killreal226/lexis/backend/docs"
	"github.com/Killreal226/lexis/backend/internal/handler"
	"github.com/Killreal226/lexis/backend/internal/middleware"
	"github.com/Killreal226/lexis/backend/internal/service"
)

type Handlers struct {
	Health   *handler.HealthHandler
	Auth     *handler.AuthHandler
	Word     *handler.WordHandler
	Learning *handler.LearningHandler
}

// New собирает mux: публичные маршруты, защищённые через RequireAuth, статика картинок.
func New(h Handlers, auth *service.AuthService, imageDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", h.Health.Check)

	mux.HandleFunc("POST /api/v1/auth/register", h.Auth.Register)
	mux.HandleFunc("POST /api/v1/auth/login", h.Auth.Login)
	mux.HandleFunc("POST /api/v1/auth/logout", h.Auth.Logout)

	requireAuth := middleware.RequireAuth(auth)
	mux.Handle("GET /api/v1/auth/me", requireAuth(http.HandlerFunc(h.Auth.Me)))

	if h.Word != nil {
		mux.Handle(
			"GET /api/v1/words/{id}",
			requireAuth(http.HandlerFunc(h.Word.GetByID)),
		)
		mux.Handle(
			"POST /api/v1/words/check",
			requireAuth(http.HandlerFunc(h.Word.Check)),
		)
		mux.Handle(
			"POST /api/v1/words",
			requireAuth(http.HandlerFunc(h.Word.Create)),
		)
	}

	if h.Learning != nil {
		mux.Handle(
			"GET /api/v1/learning/next-candidate",
			requireAuth(http.HandlerFunc(h.Learning.NextCandidate)),
		)
		mux.Handle(
			"POST /api/v1/learning/rate",
			requireAuth(http.HandlerFunc(h.Learning.Rate)),
		)
		mux.Handle(
			"POST /api/v1/learning/batch-start",
			requireAuth(http.HandlerFunc(h.Learning.BatchStart)),
		)
		mux.Handle(
			"GET /api/v1/learning/next",
			requireAuth(http.HandlerFunc(h.Learning.Next)),
		)
		mux.Handle(
			"POST /api/v1/learning/answer",
			requireAuth(http.HandlerFunc(h.Learning.Answer)),
		)
		mux.Handle(
			"GET /api/v1/learning/stats",
			requireAuth(http.HandlerFunc(h.Learning.Stats)),
		)
	}

	absImg, err := filepath.Abs(imageDir)
	if err != nil {
		absImg = imageDir
	}
	fileSrv := http.FileServer(http.Dir(absImg))
	mux.Handle("GET /images/", http.StripPrefix("/images", fileSrv))

	mux.Handle("GET /swagger/", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
	))

	return middleware.Logger(mux)
}
