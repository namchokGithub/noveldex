# Firebase Data Migration & Repo Cutover Implementation Plan

**Goal:** Migrate the existing PostgreSQL data into the Firestore schema now used by `apps/web`, then remove every active Go API/Redis runtime dependency without deleting the Postgres backup or legacy Go source.

**Scope boundary:** This plan implements and verifies the migration tooling locally or against the Firestore emulator. Running it against a real Firebase project is a deliberate one-off production operation requiring a PostgreSQL snapshot, Firebase Admin credentials, and explicit approval at the execution gate.

## Source of truth

The approved migration design predates the implemented Firebase modules and documents several field names in camelCase. The migration must instead write the current runtime contract in `apps/web/libs/firebase/*`, which uses `snake_case`:

- `novels/{novelId}`: `title`, `author`, `status`, `description`, `cover_url`, `created_at`, `updated_at`
- `novels/{novelId}/volumes/{volumeId}`: `number`, `title`, `created_at`, `updated_at`
- `novels/{novelId}/volumes/{volumeId}/chapters/{chapterId}`: `number`, `title`, `summary`, `read_at`, `novel_id`, `volume_id`, `tag_ids`, `character_ids`, `created_at`, `updated_at`
- `novels/{novelId}/chapterNumbers/{number}`: `chapter_id`
- `novels/{novelId}/characters/{characterId}`: `name`, `aliases`, `role_id`, `role`, `role_name`, `profile_image_url`, `description`, `created_at`, `updated_at`
- `novels/{novelId}/events/{eventId}`: `title`, `description`, `story_date`, `sort_order`, `chapter_id`, `chapter_volume_id`, `chapter_title`, `chapter_number`, `character_ids`, `created_at`, `updated_at`
- `novels/{novelId}/tags/{tagId}`: `name`
- `character_roles/{roleId}`: `code`, `name`, `is_active`

`first_appearance_chapter_id`, chapter counts, volume counts, read counts, and event `character_names` are computed at read time and must not be persisted.

## Task 1: Migration package and safe command interface

**Files:**

- Create `apps/web/scripts/migrate-postgres-to-firestore.ts`
- Create `apps/web/scripts/migrate-postgres-to-firestore.test.ts`
- Modify `apps/web/package.json`, lockfile, `.env.local.example`

1. Add the Node dependencies required only by the migration tool: `firebase-admin`, `pg`, and a TypeScript runner.
2. Implement a CLI requiring `DATABASE_URL` and Firebase Admin credentials, with explicit `--dry-run`, `--project`, and `--confirm` flags.
3. Reject a real write unless `--confirm` is present; print source and destination counts before committing writes.
4. Use fixed Postgres UUIDs as Firestore document IDs so retries are idempotent. Use the original PostgreSQL timestamps, converted to Admin SDK `Timestamp`s.
5. Test mapping and validation against a disposable Postgres fixture/emulator-compatible Firestore target; no test may contact a real Firebase project.

## Task 2: Read and validate the relational source snapshot

1. Read `novels`, `volumes`, `chapters`, `characters`, `character_roles`, `events`, and `tags` using parameter-free, deterministic queries.
2. Read `chapter_tags`, `chapter_characters`, and `event_characters` once each and build maps keyed by parent ID. Avoid N+1 PostgreSQL queries.
3. Join chapters to volumes to obtain `novel_id`; the current Postgres schema dropped `chapters.novel_id` in migration 000011.
4. Join events to chapters and volumes to derive `chapter_volume_id`, `chapter_title`, and `chapter_number`.
5. Abort before any Firestore write on orphaned references, duplicate chapter numbers within a novel, missing role masters, or an event whose non-null `chapter_id` cannot resolve to a chapter and volume.

## Task 3: Write Firestore documents and markers

1. Write global `character_roles` first, including inactive roles so `getCharacterRoles` can filter them in the client.
2. Write every novel document, then its tags, volumes, characters, chapters, `chapterNumbers` markers, and events using bounded Admin SDK batches or `BulkWriter`.
3. Every chapter write includes `novel_id`, `volume_id`, tag IDs, and character IDs. Create exactly one marker for each chapter number under its novel.
4. Every event with a chapter link writes all four denormalized link fields: `chapter_id`, `chapter_volume_id`, `chapter_title`, and `chapter_number`. Events without a link write `null` for all four fields.
5. Preserve empty arrays and nullable fields in the shapes expected by the existing Firestore mappers.
6. Make retries safe by setting documents by fixed path, not by auto-generated IDs. Do not delete destination documents as part of a retry.

## Task 4: Migration verification and production execution runbook

1. Add a `--verify-only` mode that compares Postgres row counts with Firestore document counts, including nested chapter/tag/character/event collections and chapter-number markers.
2. Verify representative document field equality and relationship cardinalities. Check all event chapter links have the required `chapter_volume_id`.
3. Document the production runbook: take a PostgreSQL backup, stop writes to the old app, run dry-run, run verified migration with `--confirm`, deploy Firestore indexes, run verification, and retain Postgres as read-only backup.
4. Require an explicit user approval before any command targets a non-emulator Firebase project or a production database.

## Task 5: Runtime cutover

1. Disable the Search Palette's Go `/search` request; full-text search is deferred, so the command palette must display an unavailable/deferred state rather than make a request to a retired API.
2. Remove `api` from `make dev` and delete the `make api` target. Keep `make web`, `make db`, database backup/restore, and Firebase emulator commands.
3. Remove the Redis service from `docker-compose.yml`. Keep Postgres solely for backup/migration access.
4. Do not delete `apps/api` in this plan; source deletion/restructure remains the explicitly deferred post-migration cleanup item.

## Task 6: Documentation and release checks

1. Update `CLAUDE.md`, `docs/ai/CONTEXT.md`, and `docs/engineering/DECISIONS.md` to describe direct Firestore access, the retained read-only Postgres backup, removed Redis runtime, and deferred search.
2. Add an ADR superseding ADR-002 and record that Firestore rules remain public only until Phase 5 auth work.
3. Update `PROGRESS.md` only after all safe implementation and verification work has passed; record the production migration execution separately from the code landing.
4. Run `vitest`, ESLint, TypeScript, and a manual browser smoke test with `make dev` after the cutover.

## Completion criteria

- The migration tool can dry-run, migrate idempotently, and verify a known snapshot.
- All event chapter links have a valid `chapter_volume_id` after migration.
- The web app has no runtime request to the Go API.
- `make dev` starts only the supported local services and the web app; Redis is absent.
- PostgreSQL data and legacy Go source remain intact as recovery material.
