# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start everything (docker infra + api + web in parallel)
make dev

# Run services individually
make api          # Go API on :8080
make web          # Next.js on :3000

# Database
make db           # psql into local postgres
make migrate-up   # apply migrations (requires DATABASE_URL)
make migrate-down # roll back one migration
make logs         # tail docker compose logs
```

ENV setup before first run:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Web lint: `cd apps/web && pnpm lint`

## Architecture

Monorepo, no workspace tooling. Two apps, one git history.

```
apps/api/          Go 1.24 backend
  cmd/server/      entry point (chi router, middleware)
  internal/config/ ENV loading via godotenv
  internal/handler/ HTTP handlers (one file per domain)
  migrations/      golang-migrate SQL files

apps/web/          Next.js 16 + React 19 + Tailwind v4 frontend
  app/             App Router pages
```

**API** (Go): chi v5 router. Config loaded from ENV via `internal/config`. Handlers are plain `http.HandlerFunc`s in `internal/handler/`. DB via `database/sql` + `lib/pq`.

**Web** (Next.js 16): React 19 Server Components. Tailwind v4 (PostCSS plugin, not CLI). `NEXT_PUBLIC_API_URL` env var points at API.

**Infra**: Postgres 16 + Redis 7 via Docker Compose locally. Prod: API on Fly.io, web on Vercel, DB on Neon.

## Critical: Next.js 16

Next.js 16 has breaking API/convention changes vs training data. **Before writing any Next.js code, read the relevant guide in `apps/web/node_modules/next/dist/docs/`.** Heed deprecation notices.

## DB Conventions

- UUIDs as primary keys (`gen_random_uuid()`)
- `created_at`, `updated_at` on all tables (trigger-managed)
- Soft deletes via nullable `deleted_at`
- `story_date` stored as `TEXT` — in-universe dates are non-standard (fictional eras, approximate seasons)

## Key Constraints

- No auth until Phase 5 (ADR-003). All data is unowned. Do not add user_id FKs or session middleware before then.
- Timeline sort order handled in application layer or via a separate `story_date_sort_key INTEGER` column, not by parsing `story_date`.
- Migrations use `golang-migrate`. File naming: `{version}_{description}.up.sql` / `.down.sql`.
