# NovelDex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase Refactor: Firebase Migration (Go API + Postgres → Firestore) ← current

Spec: `docs/superpowers/specs/2026-08-28-firebase-migration-design.md`

- [x] Plan 1 — Firebase foundation + `novels` domain (`docs/superpowers/plans/2026-08-28-firebase-foundation-and-novels.md`)
- [x] Plan 2 — `tags` + `volumes` + `chapters` domains: CRUD, tag linking, bulk reorder, `[[Name]]` mention auto-link (temporary Go API hybrid), `getLastOrderNos` (`docs/superpowers/plans/2026-08-28-firebase-volumes-chapters-tags.md`)
- [x] Plan 3 — `characters` + `character_roles` + `events` domains via Firestore; temporary mention-link/character-hydration Go API hybrid removed; character call sites rewired; timeline migrated to Firestore and its chapter-picker regression fixed (`docs/superpowers/plans/2026-08-28-firebase-characters-roles-events.md`). Final verification: 61 Vitest tests, ESLint, and TypeScript check passed.
- [ ] Plan 4 — implementation in progress: idempotent Postgres→Firestore migration CLI, `chapter_volume_id` event backfill, and Go API/Redis runtime cutover are implemented. Remaining: on a machine with Docker/PostgreSQL, restore `backups/postgres/noveldex-20260828-233248.sql` into a disposable PostgreSQL 16 database, configure `DATABASE_URL`, `FIREBASE_PROJECT_ID`, and Firebase Admin credentials, then run `--dry-run` and `--verify-only` before the separately approved production write (`docs/superpowers/plans/2026-08-28-firebase-data-migration-and-cutover.md`).
- [ ] Full-text search on Firestore — deferred since Plan 1 (Firestore has no native full-text search); needs a prefix-match or external-service decision before it's rebuilt
- [ ] Verify `firestore.indexes.json` composite indexes against a real Firebase project — the local emulator doesn't enforce index requirements, so these have never actually been validated
- [ ] Post-migration repo cleanup (deferred until Plan 4 lands): remove old Go API code, restructure project layout, consolidate duplicate docs (root `README.md` / `CLAUDE.md` / `docs/ai/AGENTS.md` / `docs/ai/CONTEXT.md` all overlap on stack/commands), add `docs/_todo_logs.md`, update root `README.md`

## Phase 3: Timeline

- [ ] Handle unknown / approximate dates

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
- [ ] `app/novels/NovelCover.tsx` has a pre-existing TypeScript error (`next/image` `src` prop type mismatch) — pre-existing, unrelated to the Firebase migration
