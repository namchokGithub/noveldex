# Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap noveldex monorepo with a Go API skeleton, Next.js frontend, Docker Compose dev services, and deployment config — no features, no tests, just a working local + deployable foundation.

**Architecture:** Chi-based Go HTTP server with clean internal package layout (config/handler). Next.js App Router SSR page fetches /health at render time. Docker Compose runs Postgres + Redis only; apps run natively.

**Tech Stack:** Go 1.23, chi v5, godotenv, lib/pq · Next.js 15 App Router + TypeScript + Tailwind CSS · PostgreSQL 16 · Redis 7 · Docker Compose · golang-migrate (CLI) · Fly.io

---

## File Map

```
noveldex/
├── apps/
│   ├── api/
│   │   ├── cmd/server/main.go          # entry point, server boot
│   │   ├── internal/
│   │   │   ├── config/config.go        # ENV loading via godotenv
│   │   │   └── handler/health.go       # GET /health → JSON
│   │   ├── migrations/.gitkeep         # empty, ready for golang-migrate
│   │   ├── go.mod
│   │   ├── Dockerfile                  # multi-stage alpine
│   │   ├── fly.toml
│   │   └── .env.example
│   └── web/
│       ├── app/
│       │   ├── layout.tsx              # root layout (create-next-app default)
│       │   └── page.tsx                # homepage — fetch /health, display status
│       ├── .env.local.example
│       └── (all other create-next-app files)
├── docker-compose.yml                  # postgres 16 + redis 7-alpine
├── Makefile                            # dev/api/web/migrate/db/logs shortcuts
├── .gitignore                          # updated: Go + Node + .env.local
└── README.md                           # (already exists)
```

---

## Task 1: Directory scaffold + .gitignore update

**Files:**
- Create: `apps/api/` (directory tree)
- Modify: `.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p apps/api/cmd/server
mkdir -p apps/api/internal/config
mkdir -p apps/api/internal/handler
mkdir -p apps/api/migrations
touch apps/api/migrations/.gitkeep
mkdir -p apps/web
mkdir -p docs/superpowers/plans
```

- [ ] **Step 2: Update .gitignore — replace existing content**

The current `.gitignore` is Node-only. Replace with one that covers Go + Node + Next.js + env files:

```gitignore
# ── Env ──────────────────────────────────────────────────────────────────────
.env
.env.local
.env.*.local
!.env.example
!.env.local.example

# ── Go ───────────────────────────────────────────────────────────────────────
apps/api/vendor/
apps/api/tmp/
apps/api/server

# ── Node / Next.js ───────────────────────────────────────────────────────────
node_modules/
.next/
out/
dist/
*.tsbuildinfo
.npm
.eslintcache
.stylelintcache
.pnpm-store

# ── Logs ─────────────────────────────────────────────────────────────────────
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ── OS / IDE ─────────────────────────────────────────────────────────────────
.DS_Store
*.swp
.vscode/
.idea/

# ── Misc ─────────────────────────────────────────────────────────────────────
coverage/
*.lcov
.nyc_output/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore apps/api/migrations/.gitkeep
git commit -m "chore: scaffold directory structure and update gitignore"
```

---

## Task 2: Go module init + dependencies

**Files:**
- Create: `apps/api/go.mod`

- [ ] **Step 1: Init Go module**

```bash
cd apps/api
go mod init github.com/Namchok/noveldex/api
```

- [ ] **Step 2: Add dependencies**

```bash
go get github.com/go-chi/chi/v5@v5.2.1
go get github.com/joho/godotenv@v1.5.1
go get github.com/lib/pq@v1.10.9
```

This creates `go.mod` and `go.sum`. Verify `go.mod` looks like:

```
module github.com/Namchok/noveldex/api

go 1.23

require (
    github.com/go-chi/chi/v5 v5.2.1
    github.com/joho/godotenv v1.5.1
    github.com/lib/pq v1.10.9
)
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/go.mod apps/api/go.sum
git commit -m "chore(api): init go module with chi, godotenv, pq"
```

---

## Task 3: Go API — config package

**Files:**
- Create: `apps/api/internal/config/config.go`

- [ ] **Step 1: Write config.go**

```go
package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	Env         string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisURL:    getEnv("REDIS_URL", ""),
		Env:         getEnv("ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/api && go build ./internal/config/...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/config/config.go
git commit -m "feat(api): add config loader from ENV"
```

---

## Task 4: Go API — health handler

**Files:**
- Create: `apps/api/internal/handler/health.go`

- [ ] **Step 1: Write health.go**

```go
package handler

import (
	"encoding/json"
	"net/http"
)

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": "0.1.0",
	})
}
```

- [ ] **Step 2: Verify compile**

```bash
cd apps/api && go build ./internal/handler/...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/handler/health.go
git commit -m "feat(api): add GET /health handler"
```

---

## Task 5: Go API — main server

**Files:**
- Create: `apps/api/cmd/server/main.go`

- [ ] **Step 1: Write main.go**

```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/Namchok/noveldex/api/internal/config"
	"github.com/Namchok/noveldex/api/internal/handler"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	pingDatabase(cfg.DatabaseURL)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Get("/health", handler.Health)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s (env=%s)", addr, cfg.Env)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func pingDatabase(dsn string) {
	if dsn == "" {
		log.Println("warn: DATABASE_URL not set, skipping database ping")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("warn: failed to open database connection: %v", err)
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Printf("warn: database ping failed: %v", err)
		return
	}
	log.Println("database connected")
}
```

- [ ] **Step 2: Verify full build**

```bash
cd apps/api && go build ./cmd/server/...
```

Expected: no output. Binary `server` created in `apps/api/`.

- [ ] **Step 3: Quick smoke test (optional, needs docker up)**

```bash
cd apps/api && go run cmd/server/main.go &
sleep 1
curl http://localhost:8080/health
kill %1
```

Expected response:
```json
{"status":"ok","version":"0.1.0"}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/cmd/server/main.go
git commit -m "feat(api): wire chi router, health route, startup db ping"
```

---

## Task 6: Go API — Dockerfile + fly.toml

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/fly.toml`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

# ── Run stage ────────────────────────────────────────────────────────────────
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```

- [ ] **Step 2: Write fly.toml**

```toml
app = "noveldex-api"
primary_region = "sin"

[build]

[env]
  PORT = "8080"
  ENV  = "production"

[http_service]
  internal_port       = 8080
  force_https         = true
  auto_stop_machines  = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type       = "connections"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  memory   = "256mb"
  cpu_kind = "shared"
  cpus     = 1
```

- [ ] **Step 3: Verify Docker build (optional, needs Docker Desktop)**

```bash
cd apps/api
docker build -t noveldex-api:local .
docker run --rm -p 8080:8080 -e DATABASE_URL="" noveldex-api:local &
sleep 1
curl http://localhost:8080/health
docker stop $(docker ps -q --filter ancestor=noveldex-api:local)
```

Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 4: Commit**

```bash
git add apps/api/Dockerfile apps/api/fly.toml
git commit -m "chore(api): add multi-stage Dockerfile and fly.toml"
```

---

## Task 7: Go API — env example + clean up build artifact

**Files:**
- Create: `apps/api/.env.example`

- [ ] **Step 1: Write .env.example**

```ini
PORT=8080
DATABASE_URL=postgres://postgres:password@localhost:5432/noveldex?sslmode=disable
REDIS_URL=redis://localhost:6379
ENV=development
```

- [ ] **Step 2: Remove compiled binary if present**

```bash
rm -f apps/api/server
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example
git commit -m "chore(api): add .env.example"
```

---

## Task 8: Next.js app scaffold

**Files:**
- Create: `apps/web/` (full Next.js project via create-next-app)
- Create: `apps/web/.env.local.example`

- [ ] **Step 1: Scaffold with create-next-app**

Run from repo root:

```bash
npx create-next-app@latest apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --no-import-alias \
  --use-pnpm
```

When prompted for project name, it uses the directory name (`web`). Accept all defaults.

- [ ] **Step 2: Verify it runs**

```bash
cd apps/web && pnpm dev &
sleep 3
curl -s http://localhost:3000 | head -20
kill %1
```

Expected: HTML output with Next.js boilerplate.

- [ ] **Step 3: Create .env.local.example**

```ini
NEXT_PUBLIC_API_URL=http://localhost:8080
```

- [ ] **Step 4: Commit**

```bash
git add apps/web apps/web/.env.local.example
git commit -m "chore(web): scaffold Next.js 15 app with Tailwind"
```

---

## Task 9: Next.js — homepage with API health status

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace page.tsx**

Delete all boilerplate from `apps/web/app/page.tsx` and write:

```tsx
interface HealthResponse {
  status: string
  version: string
}

async function getHealth(): Promise<HealthResponse | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  try {
    const res = await fetch(`${base}/health`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function Home() {
  const health = await getHealth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 text-white">
      <h1 className="text-4xl font-bold tracking-tight">NovelDex</h1>
      <div className="flex items-center gap-2 rounded-lg border border-gray-800 px-4 py-2 text-sm">
        <span className="text-gray-400">API</span>
        {health ? (
          <>
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-green-400">
              {health.status} · v{health.version}
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-red-400">unavailable</span>
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Start API + web, verify in browser**

Terminal 1:
```bash
cd apps/api && cp .env.example .env && go run cmd/server/main.go
```

Terminal 2:
```bash
cd apps/web && echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local && pnpm dev
```

Open http://localhost:3000 — expect green dot with "ok · v0.1.0".

Stop API — refresh — expect red dot "unavailable".

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): homepage displays API health status"
```

---

## Task 10: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: noveldex
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 2: Verify services start**

```bash
docker compose up -d
docker compose ps
```

Expected: both services `healthy` or `running`.

```bash
docker compose exec postgres psql -U postgres -d noveldex -c "SELECT 1;"
docker compose exec redis redis-cli ping
```

Expected: `1` and `PONG`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose with postgres 16 and redis 7"
```

---

## Task 11: Makefile

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write Makefile**

```makefile
.PHONY: dev api web migrate-up migrate-down db logs

dev:
	docker compose up -d
	$(MAKE) -j2 api web

api:
	cd apps/api && go run cmd/server/main.go

web:
	cd apps/web && pnpm dev

migrate-up:
	migrate -path apps/api/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path apps/api/migrations -database "$(DATABASE_URL)" down 1

db:
	docker compose exec postgres psql -U postgres -d noveldex

logs:
	docker compose logs -f
```

- [ ] **Step 2: Verify commands work**

```bash
# start infra
make logs &
# expected: streaming docker compose logs

make db
# expected: drops into psql prompt — type \q to exit

DATABASE_URL=postgres://postgres:password@localhost:5432/noveldex?sslmode=disable make migrate-up
# expected: "no migration files found" or success (migrations dir is empty)
```

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add Makefile with dev/api/web/migrate/db/logs targets"
```

---

## Task 12: Full integration verification

- [ ] **Step 1: Bring up all services and apps**

```bash
# terminal 1 — infra
docker compose up -d

# terminal 2 — api (with .env pointing to docker postgres)
cd apps/api && go run cmd/server/main.go
# expected: "database connected" then "server listening on :8080"

# terminal 3 — web
cd apps/web && pnpm dev
# expected: Next.js ready on :3000
```

- [ ] **Step 2: Verify all endpoints**

```bash
curl http://localhost:8080/health
# expected: {"status":"ok","version":"0.1.0"}

curl http://localhost:3000
# expected: 200 HTML
```

- [ ] **Step 3: Open browser**

Navigate to http://localhost:3000 — verify green API status badge.

- [ ] **Step 4: Verify Docker image builds**

```bash
docker build -t noveldex-api:local apps/api/
```

Expected: successful multi-stage build.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: Phase 0 foundation complete — go api + nextjs + docker-compose"
```

---

## Spec coverage check

| Requirement | Task |
|-------------|------|
| chi router + GET /health → `{"status":"ok","version":"0.1.0"}` | Task 4, 5 |
| godotenv config loading | Task 3, 5 |
| cmd/server/, internal/config/, internal/handler/ layout | Task 1 |
| Dockerfile multi-stage alpine | Task 6 |
| fly.toml | Task 6 |
| Next.js fetch /health, display status | Task 9 |
| NEXT_PUBLIC_API_URL env var | Task 8, 9 |
| Minimal Tailwind styling | Task 9 |
| docker-compose postgres 16 + redis 7 | Task 10 |
| apps not containerized | ✓ (Makefile runs go run / pnpm dev natively) |
| make dev / api / web / migrate-up / migrate-down / db / logs | Task 11 |
| .gitignore Go + Node + .env | Task 1 |
| migrations/.gitkeep | Task 1 |
| apps/api/.env.example | Task 7 |
| apps/web/.env.local.example | Task 8 |
| DB ping on startup, log error, don't crash | Task 5 |
| No auth, no DB queries, no tests, no CI | ✓ (none added) |
