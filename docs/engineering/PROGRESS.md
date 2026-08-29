# NovelDex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 3: Timeline + Search ← current

- [ ] Timeline location + event characters — [plan](../superpowers/plans/2026-08-29-timeline-location-and-event-characters.md): เปลี่ยนจากปีเป็นเล่ม → บท → หน้า, เชื่อม/สร้างตัวละครจาก Event
- [ ] Handle unknown / approximate dates
- [ ] Full-text search on Firestore — Firestore has no native full-text search; decide between prefix matching and an external service before rebuilding it

## Phase 4.6: My Polish

- [ ] Charactors Paginator
- [ ] Enhance Appears in (1) in Charactors

## Phase 5: Auth

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
