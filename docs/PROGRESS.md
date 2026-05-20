# NovelDex — Progress

## Phase 0: Foundation

- [x] Go API skeleton (chi, config, /health)
- [x] Next.js 15 skeleton (homepage, health display)
- [x] Docker Compose (postgres, redis)
- [x] Makefile shortcuts
- [x] "SKIPED" Deploy Go API to Fly.io
- [x] "SKIPED" Deploy Next.js to Vercel

## Phase 1: MVP CRUD

- [x] novels table + migration
- [x] CRUD endpoints: POST/GET/PATCH/DELETE /novels
- [x] chapters table + migration
- [x] CRUD endpoints for chapters
- [x] Next.js: list + detail pages

## Phase 2: Characters

- [x] characters table + migration (000003)
- [x] chapter_characters join table + migration (000004)
- [x] CRUD endpoints for characters (under /novels/{id}/characters)
- [x] Character profile page (with inline edit)
- [x] Chapter ↔ character appearance linking (manual + [[Name]] auto-link on summary save)
- [x] [[Name]] autocomplete dropdown in chapter editor
- [x] Characters list page with role badges + chapter counts
- [x] Characters link on novel detail page

## Phase 3: Timeline ← current

- [ ] story_date field on chapters (TEXT, flexible format)
- [ ] Timeline API endpoint (ordered by story_date)
- [ ] Timeline page (visual)
- [ ] Filtering by novel / character
- [ ] Handle unknown / approximate dates

## Phase 4: Search + Tags

- [ ] tags table + join tables
- [ ] Tag CRUD + assign to novels/characters
- [ ] Full-text search on novels/chapters (pg tsvector)
- [ ] Search API endpoint
- [ ] Search UI with filters

## Phase 5: Auth

- [ ] users table + migration
- [ ] JWT-based login/register
- [ ] Protected routes (middleware)
- [ ] Per-user novel ownership
- [ ] Session handling (refresh tokens)

## Phase 6: Polish

- [ ] Pagination on all list endpoints
- [ ] Error handling + user-facing messages
- [ ] Loading/empty states in UI
- [ ] Mobile-responsive layout
- [ ] Rate limiting on API

## Phase 7: AI

- [ ] Chapter summarization (Claude API)
- [ ] Auto character extraction from chapter text
- [ ] Timeline inference from prose
- [ ] Search-by-theme / semantic search
- [ ] AI-generated wiki stubs
