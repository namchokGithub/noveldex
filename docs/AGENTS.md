# NovelDex — Agent Instructions

Read this before touching any code. Also read `docs/CONTEXT.md` for current project state.

## Project

Novel indexing webapp. Monorepo: `apps/api` (Go) + `apps/web` (Next.js 16).

## Stack

- **API:** Go 1.24, chi v5, lib/pq, godotenv. Module: `github.com/Namchok/noveldex/api`
- **Web:** Next.js 16, Tailwind v4, TypeScript, App Router
- **DB:** PostgreSQL 16, migrations via golang-migrate in `apps/api/migrations/`
- **Local infra:** Docker Compose (postgres:16, redis:7-alpine)

## Rules

- Do not commit. I'll will recheck it again.

### Go

- Package layout: `cmd/server/` (entry), `internal/config/`, `internal/handler/`, `internal/repository/` (future)
- No global state. Pass deps (db, config) explicitly.
- Errors: return up the call stack, log at the boundary (handler layer), never swallow silently
- DB queries go in `internal/repository/`, never in handlers
- Always run `go mod tidy` after adding dependencies

### Next.js

- App Router only. No pages/ directory.
- Server Components by default. `"use client"` only when needed (event handlers, browser APIs)
- Fetch from API using `NEXT_PUBLIC_API_URL` env var
- No client-side fetch for initial page data — use async Server Components

### Database

- UUIDs for PKs (`gen_random_uuid()`)
- All tables: `created_at`, `updated_at` (trigger-managed), `deleted_at` (soft delete)
- `story_date` is TEXT — in-universe dates are non-standard (see `docs/DECISIONS.md` ADR-004)
- Migration files: `{version}_{description}.up.sql` / `.down.sql` in `apps/api/migrations/`

### Git

- Conventional commits: `feat(api):`, `feat(web):`, `fix(api):`, `chore:`, `docs:`
- One logical change per commit
- Never commit `.env` or `.env.local`

## Common Commands

```bash
make dev          # start docker infra + api + web in parallel
make api          # go run apps/api only
make web          # pnpm dev apps/web only
make db           # psql into local postgres
make logs         # tail docker compose logs

# migrations (set DATABASE_URL first)
make migrate-up
make migrate-down

# Go build check
cd apps/api && go build ./...

# Next.js type check
cd apps/web && npx tsc --noEmit
```

## Phase Status

See `docs/PROGRESS.md` for current phase and checklist.
See `docs/DECISIONS.md` for why things are the way they are.
See `docs/CONTEXT.md` for current working state (update it each session).

## What NOT to do

- Don't add auth code before Phase 5
- Don't add tests (no test suite yet — Phase 1+ decision)
- Don't containerize `apps/api` or `apps/web` (they run natively)
- Don't use `any` in TypeScript without a comment explaining why
- Don't add dependencies without updating `docs/DECISIONS.md` if non-obvious
