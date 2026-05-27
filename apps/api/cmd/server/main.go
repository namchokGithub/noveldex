package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/Namchok/noveldex/api/internal/config"
	"github.com/Namchok/noveldex/api/internal/handler"
	"github.com/Namchok/noveldex/api/internal/repository"
	"github.com/Namchok/noveldex/api/internal/usecase"
	"github.com/go-chi/cors"
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

	tagRepo := repository.NewTagRepository(pool)
	tagUC := usecase.NewTagUsecase(tagRepo)
	tagH := handler.NewTagHandler(tagUC)

	volumeRepo := repository.NewVolumeRepository(pool)
	volumeUC := usecase.NewVolumeUsecase(volumeRepo)
	volumeH := handler.NewVolumeHandler(volumeUC)

	chapterRepo := repository.NewChapterRepository(pool)
	chapterUC := usecase.NewChapterUsecase(chapterRepo, characterRepo, tagRepo)
	chapterH := handler.NewChapterHandler(chapterUC, volumeUC)
	masterH := handler.NewMasterHandler(chapterUC, volumeUC, novelUC)

	eventRepo := repository.NewEventRepository(pool)
	eventUC := usecase.NewEventUsecase(eventRepo)
	eventH := handler.NewEventHandler(eventUC)

	searchRepo := repository.NewSearchRepository(pool)
	searchUC := usecase.NewSearchUsecase(searchRepo)
	searchH := handler.NewSearchHandler(searchUC)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(corsMiddleware(cfg.CORSAllowedOrigins))

	r.Get("/health", handler.Health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/master/last-order-nos", masterH.GetLastOrderNos)

		r.Get("/novels", novelH.List)
		r.Post("/novels", novelH.Create)
		r.Get("/novels/{id}", novelH.GetByID)
		r.Patch("/novels/{id}", novelH.Update)
		r.Delete("/novels/{id}", novelH.Delete)

		r.Get("/novels/{novelID}/volumes", volumeH.List)
		r.Post("/novels/{novelID}/volumes", volumeH.Create)
		r.Get("/novels/{novelID}/volumes/{volumeID}", volumeH.GetByID)
		r.Patch("/novels/{novelID}/volumes/{volumeID}", volumeH.Update)
		r.Delete("/novels/{novelID}/volumes/{volumeID}", volumeH.Delete)

		// Keep a novel-level chapter list for features that need to navigate first,
		// then resolve the exact volume-aware route without extra client-side joins.
		r.Get("/novels/{novelID}/chapters", chapterH.ListByNovel)
		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters", chapterH.List)
		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters", chapterH.Create)
		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.GetByID)
		r.Patch("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.Update)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.Delete)

		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters", characterH.ListByChapter)
		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters", characterH.LinkToChapter)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters/{characterID}", characterH.UnlinkFromChapter)

		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags", tagH.LinkToChapter)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags/{tagID}", tagH.UnlinkFromChapter)

		r.Get("/novels/{novelID}/characters", characterH.List)
		r.Post("/novels/{novelID}/characters", characterH.Create)
		r.Get("/novels/{novelID}/characters/{characterID}", characterH.GetByID)
		r.Patch("/novels/{novelID}/characters/{characterID}", characterH.Update)
		r.Delete("/novels/{novelID}/characters/{characterID}", characterH.Delete)

		r.Get("/novels/{novelID}/events", eventH.List)
		r.Post("/novels/{novelID}/events", eventH.Create)
		r.Patch("/novels/{novelID}/events/{eventID}", eventH.Update)
		r.Delete("/novels/{novelID}/events/{eventID}", eventH.Delete)
		r.Post("/novels/{novelID}/events/{eventID}/characters", eventH.LinkCharacter)
		r.Delete("/novels/{novelID}/events/{eventID}/characters/{characterID}", eventH.UnlinkCharacter)

		r.Get("/novels/{novelID}/tags", tagH.List)
		r.Post("/novels/{novelID}/tags", tagH.Create)
		r.Delete("/novels/{novelID}/tags/{tagID}", tagH.Delete)

		r.Get("/novels/{novelID}/search", searchH.Search)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s (env=%s)", addr, cfg.Env)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func corsMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	allowAll := false
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		if trimmed == "*" {
			allowAll = true
		}
		allowed[trimmed] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin != "" {
				if allowAll {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
				}
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
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
