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

## Phase 3: Timeline

- [x] events table + migration (000005) — novel-scoped, optional chapter FK, story_date TEXT, sort_order INT
- [x] event_characters join table + migration (000006)
- [x] Timeline API endpoints (GET/POST/PATCH/DELETE /novels/:id/events, character link/unlink)
- [x] Timeline page — vertical rail UI, add/edit/delete, chapter badge, character chips
- [x] Client-side filter by character
- [ ] Handle unknown / approximate dates

## Phase 4: Search + Tags ← current

- [x] tags table + migration (000007) — novel-scoped, unique per novel
- [x] chapter_tags join table + migration (000008)
- [x] search_vector columns + GIN indexes (000009) — chapters (title+summary), characters (name+description)
- [x] Tag CRUD endpoints (GET/POST/DELETE /novels/:id/tags)
- [x] Chapter↔tag link/unlink endpoints
- [x] GET /novels/:id/chapters/:id now includes tags[] in response
- [x] Search API endpoint (GET /novels/:id/search?q=&type=all|chapters|characters|events)
- [x] Search UI — global Cmd/Ctrl+K palette with chapter/character/event results
- [x] Chapter tag UI — add/remove tags from chapter detail page
- [x] Tag filter UI on chapters list

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
