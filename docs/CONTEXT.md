# NovelDex — Session Context

Paste this into a new Claude session to restore context fast.

---

## Project

Novel indexing webapp. Track chapters, characters, timelines across long-form fiction.
Monorepo: `apps/api` (Go) + `apps/web` (Next.js).

## Stack

| Layer      | Tech                              | Deploy     |
|------------|-----------------------------------|------------|
| API        | Go 1.24, chi v5, lib/pq, godotenv | Fly.io     |
| Web        | Next.js 16, Tailwind v4, TypeScript | Vercel   |
| DB         | PostgreSQL 16 (Neon)              | Neon       |
| Cache      | Redis 7                           | Fly.io     |
| Migrations | golang-migrate                    | —          |
| Local dev  | Docker Compose (postgres + redis) | —          |

## Folder Structure

```
apps/
  api/
    cmd/server/main.go          # entry point
    internal/config/config.go   # ENV loading
    internal/handler/health.go  # GET /health
    migrations/                 # golang-migrate files
    Dockerfile
    fly.toml
  web/
    app/page.tsx                # homepage (fetches /health)
docker-compose.yml
Makefile                        # make dev / api / web / migrate-up / db / logs
dox/
  PROGRESS.md                   # phase tracker
  DECISIONS.md                  # architecture decisions
  CONTEXT.md                    # this file
```

## Key Decisions

- **Monorepo** — no workspace tooling, just directories (ADR-001)
- **Go + PG** over Firebase — relational data, migration control (ADR-002)
- **No auth until Phase 5** — validate data model first (ADR-003)
- **story_date as TEXT** — in-universe dates are non-standard (ADR-004)

## DB Conventions (when Phase 1 starts)

- UUIDs for primary keys (`gen_random_uuid()`)
- `created_at`, `updated_at` on all tables (trigger-managed)
- Soft deletes via `deleted_at` nullable timestamp

## ENV

```
# apps/api/.env  (copy from .env.example)
PORT=8080
DATABASE_URL=postgres://postgres:password@localhost:5432/noveldex?sslmode=disable
REDIS_URL=redis://localhost:6379
ENV=development

# apps/web/.env.local  (copy from .env.local.example)
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Start Local Dev

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
make dev
```

---

## Status

| Field            | Value                  |
|------------------|------------------------|
| Current phase    | [Phase 0 — Foundation] |
| Last completed   | [docker-compose, Makefile, /health endpoint] |
| Working on       | [—]                    |
| Blocked by       | [—]                    |
