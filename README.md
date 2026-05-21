# noveldex

Novel indexing webapp — chapter summaries, character wiki, and timeline tracker.

## Stack

| Layer | Tech | Deploy |
|-------|------|--------|
| API | Go 1.24, chi v5, pgx/v5 | Fly.io |
| Web | Next.js 16, React 19, Tailwind v4 | Vercel |
| DB | PostgreSQL 16 | Neon |
| Cache | Redis 7 | Fly.io |

## Local dev

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
make dev
```

Apply migrations after first run:

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/noveldex?sslmode=disable make migrate-up
```

Web runs on `:3000`, API on `:8080`.

## Commands

```bash
make dev          # docker infra + api + web
make api          # Go API only
make web          # Next.js only
make migrate-up   # apply all pending migrations
make migrate-down # roll back one migration
make db           # psql shell
make logs         # tail docker logs
```

## Features

- **Novels** — track reading status, author, description
- **Volumes** — group chapters into arcs or parts within a novel
- **Chapters** — summaries with `[[Name]]` auto-linking to characters; scoped under volumes
- **Characters** — profiles, role badges, chapter appearance tracking
- **Timeline** — event log with story dates, chapter links, character tags, client-side filtering

## Status

Phase 3 (Timeline) complete. See [docs/PROGRESS.md](docs/PROGRESS.md) for full roadmap.
