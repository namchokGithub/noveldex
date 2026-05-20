package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/Namchok/noveldex/api/internal/config"
	"github.com/Namchok/noveldex/api/internal/handler"
	"github.com/Namchok/noveldex/api/internal/repository"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	pool := connectDB(cfg.DatabaseURL)
	if pool != nil {
		defer pool.Close()
	}

	novelRepo := repository.NewNovelRepository(pool)
	novelUC := usecase.NewNovelUsecase(novelRepo)
	novelH := handler.NewNovelHandler(novelUC)

	characterRepo := repository.NewCharacterRepository(pool)
	characterUC := usecase.NewCharacterUsecase(characterRepo)
	characterH := handler.NewCharacterHandler(characterUC)

	chapterRepo := repository.NewChapterRepository(pool)
	chapterUC := usecase.NewChapterUsecase(chapterRepo, characterRepo)
	chapterH := handler.NewChapterHandler(chapterUC)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", handler.Health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/novels", novelH.List)
		r.Post("/novels", novelH.Create)
		r.Get("/novels/{id}", novelH.GetByID)
		r.Patch("/novels/{id}", novelH.Update)
		r.Delete("/novels/{id}", novelH.Delete)

		r.Get("/novels/{novelID}/chapters", chapterH.List)
		r.Post("/novels/{novelID}/chapters", chapterH.Create)
		r.Get("/novels/{novelID}/chapters/{chapterID}", chapterH.GetByID)
		r.Patch("/novels/{novelID}/chapters/{chapterID}", chapterH.Update)
		r.Delete("/novels/{novelID}/chapters/{chapterID}", chapterH.Delete)

		r.Get("/novels/{novelID}/characters", characterH.List)
		r.Post("/novels/{novelID}/characters", characterH.Create)
		r.Get("/novels/{novelID}/characters/{characterID}", characterH.GetByID)
		r.Patch("/novels/{novelID}/characters/{characterID}", characterH.Update)
		r.Delete("/novels/{novelID}/characters/{characterID}", characterH.Delete)

		r.Get("/novels/{novelID}/chapters/{chapterID}/characters", characterH.ListByChapter)
		r.Post("/novels/{novelID}/chapters/{chapterID}/characters", characterH.LinkToChapter)
		r.Delete("/novels/{novelID}/chapters/{chapterID}/characters/{characterID}", characterH.UnlinkFromChapter)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s (env=%s)", addr, cfg.Env)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func connectDB(dsn string) *pgxpool.Pool {
	if dsn == "" {
		log.Println("warn: DATABASE_URL not set, skipping database connection")
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Printf("warn: failed to create database pool: %v", err)
		return nil
	}
	if err := pool.Ping(ctx); err != nil {
		log.Printf("warn: database ping failed: %v", err)
		pool.Close()
		return nil
	}
	log.Println("database connected")
	return pool
}
