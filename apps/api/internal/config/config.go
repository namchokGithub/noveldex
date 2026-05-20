package config

import (
	"os"
	"strings"
)

type Config struct {
	Port               string
	DatabaseURL        string
	RedisURL           string
	Env                string
	CORSAllowedOrigins []string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		RedisURL:           getEnv("REDIS_URL", ""),
		Env:                getEnv("ENV", "development"),
		CORSAllowedOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://127.0.0.1:3000"}),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvList(key string, fallback []string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}

	parts := strings.Split(v, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	if len(values) == 0 {
		return fallback
	}
	return values
}
