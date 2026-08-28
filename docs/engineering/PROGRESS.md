# NovelDex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase Refactor: Firebase Migration (Go API + Postgres → Firestore) ← current

Spec: `docs/superpowers/specs/2026-08-28-firebase-migration-design.md`

- [x] Plan 1 — Firebase foundation + `novels` domain (`docs/superpowers/plans/2026-08-28-firebase-foundation-and-novels.md`)
- [x] Plan 2 — `tags` + `volumes` + `chapters` domains: CRUD, tag linking, bulk reorder, `[[Name]]` mention auto-link (temporary Go API hybrid), `getLastOrderNos` (`docs/superpowers/plans/2026-08-28-firebase-volumes-chapters-tags.md`)
- [x] Plan 3 — `characters` + `character_roles` + `events` domains via Firestore; temporary mention-link/character-hydration Go API hybrid removed; character call sites rewired; timeline migrated to Firestore and its chapter-picker regression fixed (`docs/superpowers/plans/2026-08-28-firebase-characters-roles-events.md`). Final verification: 61 Vitest tests, ESLint, and TypeScript check passed.
- [x] Plan 4 — Postgres→Firestore production migration completed from `backups/postgres/noveldex-20260828-233248.sql` using a disposable PostgreSQL 16 restore. Dry-run found no integrity errors; migrated source counts were 1 novel, 5 roles, 23 volumes, 4 chapters, 1 character, 2 events, and 1 tag. `--verify-only` now checks all collection counts, event chapter-link backfills, and `chapterNumbers` markers (`docs/superpowers/plans/2026-08-28-firebase-data-migration-and-cutover.md`).
- [ ] Post-migration production validation — expanded `--verify-only` passed against the real Firebase project: all collection counts, event chapter-link backfills, and `chapterNumbers` markers match PostgreSQL. Remaining: deploy/validate `firestore.indexes.json`, then run a browser smoke test for every migrated domain.
- [ ] Full-text search on Firestore — deferred since Plan 1 (Firestore has no native full-text search); needs a prefix-match or external-service decision before it's rebuilt
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
