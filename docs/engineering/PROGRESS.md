# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 4.6: My Polish

- [ ] Enhance Appears in (1) in Characters

## Phase 5: Auth + Guest only view

- [ ] users table + migration
- [ ] JWT-based login/register
- [ ] Protected routes (middleware)
- [ ] Session handling (refresh tokens)

## Phase 6: Polish

- [ ] Error handling + user-facing messages
- [ ] Empty states in remaining pages
- [ ] Mobile-responsive layout
- [ ] Rate limiting on API

## Fix & Issue

- [ ] Unit test
- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
