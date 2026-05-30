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
      novel.go, volume.go, chapter.go, character.go, event.go
    internal/handler/                     # HTTP handlers (one file per domain)
      health.go, novel_handler.go, volume_handler.go, chapter_handler.go, character_handler.go, event_handler.go, master_handler.go
    internal/repository/                  # pgx implementations
      novel_repo.go, volume_repo.go, chapter_repo.go, character_repo.go, event_repo.go
    internal/usecase/                     # business logic
      novel_usecase.go, volume_usecase.go, chapter_usecase.go, character_usecase.go, event_usecase.go
    internal/util/
      mention.go                          # [[Name]] regex extraction
    migrations/                           # golang-migrate SQL files (000001–000012)
    Dockerfile
    fly.toml
  web/
    app/
      types.ts                            # Novel, Chapter, Character, ChapterWithCharacters
      page.tsx                            # homepage
      loading.tsx                         # global app loading skeleton
      novels/
        loading.tsx                       # novels list loading
        page.tsx                          # novel list
        AddNovelForm.tsx
        NovelCover.tsx                    # "use client" — cover image with initials fallback on error/absent
        ExpandableDescription.tsx         # "use client" — ResizeObserver clamp/expand for long descriptions
        [id]/
          loading.tsx                     # novel detail loading
          page.tsx                        # novel detail + paginated volume manager + Characters link
          AddVolumeForm.tsx
          VolumeManager.tsx               # scrollable data-table style volume list with URL-driven pagination
          AddChapterForm.tsx
          characters/
            page.tsx                      # characters list (role badges, chapter counts)
            AddCharacterForm.tsx
            [characterId]/
              page.tsx                    # character profile
              CharacterDetail.tsx         # inline edit + appears-in chapter list
          timeline/
            page.tsx                      # vertical rail timeline, add/edit/delete, character filter
          volumes/
            [volumeId]/
              loading.tsx                 # volume detail loading
              page.tsx                    # volume detail + chapter list
              chapters/[chapterId]/
                loading.tsx               # chapter detail loading
                page.tsx                  # chapter detail (fetches ChapterWithCharacters)
                ChapterEditor.tsx         # title + summary edit, [[Name]] autocomplete, tags, read_at
                SummaryRenderer.tsx       # renders [[Name]] as character links
                LinkedCharactersPanel.tsx # character chips
      libs/api/
        client.ts                         # authless fetch wrapper
        index.ts                          # web API helpers for novels/volumes/chapters/tags
docker-compose.yml
Makefile                        # make dev / api / web / migrate-up / db / logs
docs/
  README.md                     # navigation index
  ai/
    AGENTS.md                   # agent instructions
    CONTEXT.md                  # this file
    plans/                      # implementation plans
    specs/                      # design specs
  engineering/
    PROGRESS.md                 # phase tracker
    DECISIONS.md                # architecture decisions
```

## API Routes

```
GET    /health
GET    /api/v1/master/last-order-nos          # ?novel_id=&volume_id= → {volume, chapter} last numbers

GET    /api/v1/novels
POST   /api/v1/novels
GET    /api/v1/novels/:id
PATCH  /api/v1/novels/:id
DELETE /api/v1/novels/:id

GET    /api/v1/novels/:id/volumes                                       # paginated; query: page, per_page; returns items+pagination+summary
POST   /api/v1/novels/:id/volumes
GET    /api/v1/novels/:id/volumes/:volumeId
PATCH  /api/v1/novels/:id/volumes/:volumeId
DELETE /api/v1/novels/:id/volumes/:volumeId

GET    /api/v1/novels/:id/chapters                                              # flat list across all volumes (navigation)
GET    /api/v1/novels/:id/volumes/:volumeId/chapters
POST   /api/v1/novels/:id/volumes/:volumeId/chapters
PATCH  /api/v1/novels/:id/volumes/:volumeId/chapters/reorder             # bulk reorder; body: {chapters:[{id,number}]}
GET    /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId          # returns ChapterWithCharacters
PATCH  /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId          # triggers [[Name]] auto-link
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId

GET    /api/v1/novels/:id/characters
POST   /api/v1/novels/:id/characters
GET    /api/v1/novels/:id/characters/:characterId      # returns chapters appeared in
PATCH  /api/v1/novels/:id/characters/:characterId
DELETE /api/v1/novels/:id/characters/:characterId

GET    /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters
POST   /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters/:characterId

GET    /api/v1/novels/:id/events
POST   /api/v1/novels/:id/events
PATCH  /api/v1/novels/:id/events/:eventId
DELETE /api/v1/novels/:id/events/:eventId
POST   /api/v1/novels/:id/events/:eventId/characters
DELETE /api/v1/novels/:id/events/:eventId/characters/:characterId

GET    /api/v1/novels/:id/tags
POST   /api/v1/novels/:id/tags
DELETE /api/v1/novels/:id/tags/:tagId

POST   /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/tags
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/tags/:tagId

GET    /api/v1/novels/:id/search
```

## Key Decisions

- **Monorepo** — no workspace tooling, just directories (ADR-001)
- **Go + PG** over Firebase — relational data, migration control (ADR-002)
- **No auth until Phase 5** — validate data model first (ADR-003)
- **story_date as TEXT** — in-universe dates are non-standard (ADR-004)
- **pgx/v5** (not lib/pq) — switched during Phase 1 for pgxpool support
- **[[Name]] auto-link is additive** — never removes existing chapter_characters rows; fires on PATCH only
- **LinkMentions errors are non-blocking** — logged as warn, do not fail the update
- **Novel→Volume→Chapter hierarchy** — chapters belong to volumes; novel ownership derived via JOIN (ADR-005)
- **Chapter number is novel-scoped** — enforced in usecase via `NumberExistsInNovel`; DB constraint is per-volume for performance
- **Data migration creates "Volume 1"** — all pre-existing chapters land in a generated Volume 1 per novel
- **Web flow is Novel → Volume → Chapter** — novel page manages volumes; volume page manages chapters
- **Route loading uses central skeleton component** — `PageLoadingState` in `app/novels/ui.tsx` powers segment `loading.tsx` files
- **volume_id on ChapterSummary/Event** — propagated so web can build volume-scoped URLs without extra round-trips
- **read_at is TIMESTAMPTZ** — migration 000012; API accepts RFC3339, ISO datetime, or date-only during rollout
- **ConfirmDialog + Snackbar are standard mutation UI** — exported from `app/novels/ui.tsx`; all destructive actions use ConfirmDialog, all mutations surface Snackbar feedback
- **Chapter reorder uses number mutation** — `PATCH .../chapters/reorder` redistributes existing numbers (sorted asc) among chapters in new drag order; no separate position field; BulkReorder uses single UPDATE…unnest statement for atomicity
- **Novel volume list is paginated at the API layer** — `GET /novels/:id/volumes` accepts `page` and `per_page`, defaults to `1/5`, and only allows `5|10|20|50`
- **Volume list response is aggregate-aware** — rows already include `chapter_count` and `read_count`; response `summary` carries cross-page totals so the novel page does not fan out chapter-list calls
- **Volume manager is a scrollable table panel** — only the row area scrolls; table controls and pagination remain fixed in the card
- **Volume list links disable prefetch** — prevents Next.js from eagerly loading each volume page and triggering `getVolume` / `getChaptersByVolume` across the whole list

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
| 000007 | create_tags | tags table (novel-scoped) |
| 000008 | create_chapter_tags | chapter↔tag join table |
| 000009 | add_search_vector | tsvector generated column on chapters for full-text search |
| 000010 | create_volumes | volumes table (novel-scoped, UNIQUE(novel_id, number)) |
| 000011 | add_volume_to_chapters | chapters get volume_id FK; novel_id dropped; data migration creates Volume 1 per novel |
| 000012 | change_chapter_read_at_to_timestamptz | read_at DATE → TIMESTAMPTZ (UTC cast for existing rows) |

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
| Current phase  | Phase 4 — Search + Tags / Volume web layer |
| Last completed | paginated volume listing with aggregate counts and scrollable data-table volume manager |
| Working on     | — |
| Blocked by     | — |
