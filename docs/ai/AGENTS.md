# NovelDex — Agent Instructions

Read this before touching any code. Also read `docs/ai/CONTEXT.md` for current project state.

## Project

Novel indexing webapp. Monorepo: `apps/api` (Go) + `apps/web` (Next.js 16).

## Stack

- **API:** Go 1.24, chi v5, pgx/v5, godotenv. Module: `github.com/Namchok/noveldex/api`
- **Web:** Next.js 16, Tailwind v4, TypeScript, App Router
- **DB:** PostgreSQL 16, migrations via golang-migrate in `apps/api/migrations/`
- **Local infra:** Docker Compose (postgres:16, redis:7-alpine)

## Rules

- Do not commit. I'll will recheck it again.

### Go

- Package layout: `cmd/server/` (entry), `internal/config/`, `internal/handler/`, `internal/repository/`, `internal/usecase/`, `internal/domain/`, `internal/util/`
- No global state. Pass deps (db, config) explicitly.
- Errors: return up the call stack, log at the boundary (handler layer), never swallow silently
- DB queries go in `internal/repository/`, never in handlers
- Always run `go mod tidy` after adding dependencies

### Next.js

- App Router only. No pages/ directory.
- Server Components by default. `"use client"` only when needed (event handlers, browser APIs)
- Fetch from API using `NEXT_PUBLIC_API_URL` env var
- No client-side fetch for initial page data — use async Server Components
- Keep server-driven list state in URL query params when it affects the initial render (`page`, `per_page`, filters)
- Destructive actions (delete, overwrite) must gate behind `ConfirmDialog` from `app/novels/ui.tsx`
- Mutation success/error feedback via `Snackbar` from `app/novels/ui.tsx` — not alert() or inline flash
- Disable `Link` prefetch on dense volume lists when it would eagerly trigger per-row detail fetches

### Database

- UUIDs for PKs (`gen_random_uuid()`)
- All tables: `created_at`, `updated_at` (trigger-managed), `deleted_at` (soft delete)
- `story_date` is TEXT — in-universe dates are non-standard (see `docs/engineering/DECISIONS.md` ADR-004)
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

See `docs/engineering/PROGRESS.md` for current phase and checklist.
See `docs/engineering/DECISIONS.md` for why things are the way they are.
See `docs/ai/CONTEXT.md` for current working state (update it each session).

## What NOT to do

- Don't add auth code before Phase 5
- Don't add tests (no test suite yet — Phase 1+ decision)
- Don't containerize `apps/api` or `apps/web` (they run natively)
- Don't use `any` in TypeScript without a comment explaining why
- Don't add dependencies without updating `docs/engineering/DECISIONS.md` if non-obvious

## Current Volume Listing Contract

- `GET /api/v1/novels/:novelID/volumes` is paginated
- Query params: `page`, `per_page`
- Defaults: `page=1`, `per_page=5`
- Allowed page sizes: `5`, `10`, `20`, `50`
- Response shape: `data: { items, pagination, summary }`
- Each volume row includes `chapter_count` and `read_count`
- `summary` includes `total_volumes`, `total_chapters`, `read_count`
- Do not fan out `getChaptersByVolume` from the novel page just to compute counts

## Current Volume Manager UI

- `app/novels/[id]/page.tsx` reads `searchParams.page` and `searchParams.per_page` on the server
- `VolumeManager.tsx` is a paginated data-table style panel, not a plain list
- Only the volume rows scroll; the top toolbar and bottom pager stay fixed within the card
- Volume detail links in this panel must stay `prefetch={false}`
