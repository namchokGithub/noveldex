# NovelDex — Session Context

Paste this into a new Claude session to restore context fast.

---

## Project

Novel indexing webapp. Track chapters, characters, timelines across long-form fiction.
Monorepo: `apps/api` (Go) + `apps/web` (Next.js).

## Stack

| Layer      | Tech                                    | Deploy  |
|------------|-----------------------------------------|---------|
| API        | Go 1.24, chi v5, pgx/v5, godotenv      | Fly.io  |
| Web        | Next.js 16, React 19, Tailwind v4, TypeScript | Vercel |
| DB         | PostgreSQL 16 (Neon)                    | Neon    |
| Cache      | Redis 7                                 | Fly.io  |
| Migrations | golang-migrate                          | —       |
| Local dev  | Docker Compose (postgres + redis)       | —       |

## Folder Structure

```
apps/
  api/
    cmd/server/main.go                    # entry point, chi router, all routes
    internal/config/config.go             # ENV loading
    internal/domain/                      # structs + repository interfaces
      novel.go, chapter.go, character.go, event.go
    internal/handler/                     # HTTP handlers (one file per domain)
      health.go, novel_handler.go, chapter_handler.go, character_handler.go, event_handler.go
    internal/repository/                  # pgx implementations
      novel_repo.go, chapter_repo.go, character_repo.go, event_repo.go
    internal/usecase/                     # business logic
      novel_usecase.go, chapter_usecase.go, character_usecase.go, event_usecase.go
    internal/util/
      mention.go                          # [[Name]] regex extraction
    migrations/                           # golang-migrate SQL files (000001–000006)
    Dockerfile
    fly.toml
  web/
    app/
      types.ts                            # Novel, Chapter, Character, ChapterWithCharacters
      page.tsx                            # homepage
      novels/
        page.tsx                          # novel list
        AddNovelForm.tsx
        [id]/
          page.tsx                        # novel detail + chapters list + Characters link
          AddChapterForm.tsx
          chapters/[chapterId]/
            page.tsx                      # chapter detail (fetches ChapterWithCharacters)
            ChapterEditor.tsx             # summary edit + [[Name]] autocomplete + characters panel
            SummaryRenderer.tsx           # renders [[Name]] as character links
            LinkedCharactersPanel.tsx     # character chips
          characters/
            page.tsx                      # characters list (role badges, chapter counts)
            AddCharacterForm.tsx
            [characterId]/
              page.tsx                    # character profile
              CharacterDetail.tsx         # inline edit + appears-in chapter list
          timeline/
            page.tsx                      # vertical rail timeline, add/edit/delete, character filter
docker-compose.yml
Makefile                        # make dev / api / web / migrate-up / db / logs
docs/
  PROGRESS.md                   # phase tracker
  DECISIONS.md                  # architecture decisions
  CONTEXT.md                    # this file
```

## API Routes

```
GET    /health
GET    /api/v1/novels
POST   /api/v1/novels
GET    /api/v1/novels/:id
PATCH  /api/v1/novels/:id
DELETE /api/v1/novels/:id

GET    /api/v1/novels/:id/chapters
POST   /api/v1/novels/:id/chapters
GET    /api/v1/novels/:id/chapters/:chapterId          # returns ChapterWithCharacters
PATCH  /api/v1/novels/:id/chapters/:chapterId          # triggers [[Name]] auto-link
DELETE /api/v1/novels/:id/chapters/:chapterId

GET    /api/v1/novels/:id/characters
POST   /api/v1/novels/:id/characters
GET    /api/v1/novels/:id/characters/:characterId      # returns chapters appeared in
PATCH  /api/v1/novels/:id/characters/:characterId
DELETE /api/v1/novels/:id/characters/:characterId

GET    /api/v1/novels/:id/chapters/:chapterId/characters
POST   /api/v1/novels/:id/chapters/:chapterId/characters
DELETE /api/v1/novels/:id/chapters/:chapterId/characters/:characterId

GET    /api/v1/novels/:id/events
POST   /api/v1/novels/:id/events
PATCH  /api/v1/novels/:id/events/:eventId
DELETE /api/v1/novels/:id/events/:eventId
POST   /api/v1/novels/:id/events/:eventId/characters
DELETE /api/v1/novels/:id/events/:eventId/characters/:characterId
```

## Key Decisions

- **Monorepo** — no workspace tooling, just directories (ADR-001)
- **Go + PG** over Firebase — relational data, migration control (ADR-002)
- **No auth until Phase 5** — validate data model first (ADR-003)
- **story_date as TEXT** — in-universe dates are non-standard (ADR-004)
- **pgx/v5** (not lib/pq) — switched during Phase 1 for pgxpool support
- **[[Name]] auto-link is additive** — never removes existing chapter_characters rows; fires on PATCH only
- **LinkMentions errors are non-blocking** — logged as warn, do not fail the update

## DB Conventions

- UUIDs for primary keys (`gen_random_uuid()`)
- `created_at`, `updated_at` on all tables (trigger-managed)
- Soft deletes via `deleted_at` nullable timestamp
- `story_date` stored as TEXT (fictional/non-standard eras)
- `aliases` stored as `TEXT[]` on characters; normalized to `[]string{}` (never nil) in Go

## Migrations

| # | File | Description |
|---|------|-------------|
| 000001 | create_novels | novels table |
| 000002 | create_chapters | chapters table |
| 000003 | create_characters | characters table (TEXT[] aliases, role DEFAULT 'minor') |
| 000004 | create_chapter_characters | join table (composite PK) |
| 000005 | create_events | events table (novel-scoped, optional chapter FK, story_date TEXT, sort_order INT) |
| 000006 | create_event_characters | event↔character join table (composite PK) |

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

Run migrations after first `make dev`:
```bash
make migrate-up
```

---

## Status

| Field          | Value                          |
|----------------|--------------------------------|
| Current phase  | Phase 4 — Search + Tags        |
| Last completed | Phase 3 — Timeline (full stack) |
| Working on     | —                              |
| Blocked by     | —                              |
