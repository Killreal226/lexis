// @title           Lexis API
// @version         1.0
// @description     API сервиса для изучения английских слов.
// @host            localhost:8080
// @BasePath        /api/v1
// @securityDefinitions.apikey  BearerAuth
// @in                          header
// @name                        Authorization
// @description                 Введите токен в формате: Bearer <token>
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/Killreal226/lexis/backend/internal/config"
	"github.com/Killreal226/lexis/backend/internal/database"
	"github.com/Killreal226/lexis/backend/internal/handler"
	"github.com/Killreal226/lexis/backend/internal/repository"
	"github.com/Killreal226/lexis/backend/internal/router"
	"github.com/Killreal226/lexis/backend/internal/service"
	"github.com/Killreal226/lexis/backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	db, err := database.NewDB(cfg.DSN())
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	wordRepo := repository.NewWordRepository(db)
	progressRepo := repository.NewProgressRepository(db)
	authService := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTAccessTTL)

	imageDir := cfg.StoragePath
	if !filepath.IsAbs(imageDir) {
		wd, err := os.Getwd()
		if err != nil {
			log.Fatalf("get working directory: %v", err)
		}
		imageDir = filepath.Join(wd, imageDir)
	}

	imageStore, err := storage.NewImageStore(imageDir, "/images")
	if err != nil {
		log.Fatalf("image store: %v", err)
	}

	wordService := service.NewWordService(wordRepo, imageStore)
	learningService := service.NewLearningService(progressRepo, wordRepo)

	handlers := router.Handlers{
		Health:   handler.NewHealthHandler(db),
		Auth:     handler.NewAuthHandler(authService),
		Word:     handler.NewWordHandler(wordService),
		Learning: handler.NewLearningHandler(learningService),
	}

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           router.New(handlers, authService, imageDir),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("listening on %s", srv.Addr)
	log.Fatal(srv.ListenAndServe())
}
