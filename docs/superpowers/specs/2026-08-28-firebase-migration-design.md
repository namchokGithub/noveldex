# Firebase Migration Design

**Date:** 2026-08-28
**Status:** Approved
**Scope:** Full stack — retires `apps/api` (Go), moves all data access to direct client Firestore

---

## Problem

The current architecture is Next.js web → Go API (chi) → Postgres (Neon), with Redis for caching. The project wants to drop the Go API layer entirely and have the Next.js web app talk to Firebase (Firestore) directly from the client. Scope is the full domain (novels, volumes, chapters, characters, events, tags, character role master) — not just novels — migrated in one pass. This supersedes ADR-002.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Scope | All domains move to Firestore together | User chose full-domain migration over a novels-only MVP or staged rollout |
| Firebase product | Firestore | Document model fits denormalized read patterns; native web SDK support |
| Access pattern | Direct client SDK from browser, no server layer | Explicit requirement — no API, no Cloud Functions, no Server Actions/Admin SDK |
| Security rules | Public read/write (`if true`) for now | Matches ADR-003 (no auth until Phase 5). **Revisit ADR-003 when Phase 5 lands — public Firestore rules must be replaced with authenticated rules at that point, not left open.** |
| Existing Postgres data | Migrate once into Firestore; Postgres is kept, not dropped | Serves as read-only historical backup; no code path reads from it after migration |
| Cache (Redis) | Dropped entirely | No server layer left to front with a cache; Firestore's client SDK offline/IndexedDB persistence covers the same need for free |
| Full-text search (`/search`, tsvector) | Disabled for this migration, revisit later | Firestore has no native full-text search; replacing it (prefix match or external service like Algolia) is out of scope for now |
| `libs/api/` call-site shape | Kept stable; internals swapped to Firestore calls | Minimizes churn across all `app/novels/**` pages that call these helpers |

---

## Data Model

Firestore has no joins or FKs — join tables become denormalized array fields, and relational uniqueness becomes a marker-document pattern.

```
novels/{novelId}
  volumes/{volumeId}
    chapters/{chapterId}
      - characterIds: string[]        # replaces chapter_characters join table
      - tagIds: string[]              # replaces chapter_tags join table
      - story_date: string
      - story_date_sort_key: number
      - deletedAt: Timestamp | null
    chapterNumbers/{number}           # marker doc, uniqueness index (see below)
  characters/{characterId}
    - roleId: string                  # ref -> character_roles (global)
    - roleName: string                # denormalized for display, avoids extra read
  events/{eventId}
    - characterIds: string[]
    - chapterId: string | null
  tags/{tagId}

character_roles/{roleId}              # root collection, global master (unchanged in shape)
```

**Reverse lookups** (e.g. "which chapters does this character appear in", previously a JOIN) use a **collectionGroup query**: `collectionGroup('chapters').where('characterIds', 'array-contains', characterId)`. This avoids maintaining a second denormalized list and avoids dual-write consistency issues.

**`created_at` / `updated_at`**: previously DB-trigger-managed. Firestore has no triggers reachable without server code, so every mutation must set `updated_at: serverTimestamp()` explicitly. This must go through a small shared write helper, not be repeated inline at each call site, or it will be missed somewhere.

**Soft deletes (`deleted_at`)**: every list query must explicitly filter `where('deletedAt', '==', null)`. Firestore has no partial-index equivalent to enforce this automatically — same shared query-helper requirement as above.

**`story_date` / `story_date_sort_key`**: carried over unchanged as plain fields (per existing ADR-004 and the Timeline sort constraint). Sorting by `story_date_sort_key` combined with the `deletedAt` filter requires a **composite index** — commit `firestore.indexes.json` to the repo, the Firestore equivalent of a migration file.

---

## Business Logic Relocation

Everything that lived in the Go usecase layer moves to client-side helper functions in `apps/web/libs/firebase/`. No Cloud Functions — logic runs in the browser.

### Mention auto-link (`[[Name]]`)

Previously: PATCH chapter → regex extract mentions → link characters, errors logged as non-blocking warnings, never removes existing links.

New: after a chapter `updateDoc()` succeeds, call a `linkMentions()` helper — regex-parse the summary, resolve names via `where('name', 'in', names)` (Firestore `in` supports up to 30 values), then `updateDoc(chapter, { characterIds: arrayUnion(...ids) })`. Wrapped in try/catch; failures are logged, never thrown — same behavior as today.

### Chapter number uniqueness (novel-scoped)

Previously: DB `UNIQUE(volume_id, number)` constraint (per-volume) plus a novel-scoped uniqueness check in the usecase layer.

Firestore has no unique constraints, and the client SDK's `runTransaction` only supports reads by document reference, not by query — so a naive "query then write" check is racy.

**Marker document pattern**: `novels/{novelId}/chapterNumbers/{number}` is an otherwise-empty doc that exists purely as a uniqueness index. Creating a chapter is one `runTransaction`:
1. `transaction.get(chapterNumberMarkerRef)` — must not exist
2. `transaction.set(chapterNumberMarkerRef, { chapterId })`
3. `transaction.set(chapterRef, {...chapterData})`

Both operations are plain document references, so this is genuinely atomic in the client SDK.

### Bulk reorder

Previously: one atomic SQL `UPDATE ... FROM unnest(...)` statement.

New: one `writeBatch()`. For each chapter whose number changes: delete the old `chapterNumbers/{oldNumber}` marker, create the new `chapterNumbers/{newNumber}` marker, update `chapter.number` — all in the same batch. A batch tops out at 500 operations; a single volume's chapter list is nowhere near that.

### Full-text search

Disabled. `GET /api/v1/novels/:id/search` and the tsvector-backed search have no Firestore equivalent without either weakening to prefix match (`where('titleLower', '>=', q).where('titleLower', '<=', q + '')`) or adding external infra (Algolia/Typesense). Per user decision, this is deferred rather than solved now.

---

## Cache

Redis is dropped entirely — there's no server layer left to front with a cache. Firestore's client SDK provides IndexedDB-backed offline persistence, which covers the same "avoid refetching" need without extra infrastructure. Component-level caching (SWR/React Query) is not added now — YAGNI until a concrete need shows up.

---

## Infra / Repo Changes

- `apps/api` (Go) removed from the active dev loop — `make dev` and `make api` targets dropped
- `docker-compose.yml` — `redis` service removed; `postgres` service kept (read-only backup access via `make db`, not used at runtime by the app)
- `apps/web/libs/api/` — implementations swapped from `fetch(NEXT_PUBLIC_API_URL)` to Firestore SDK calls; exported function signatures (`getNovels()`, `createChapter()`, etc.) stay the same so page components don't need changes
- New `apps/web/libs/firebase/` — Firebase app initialization + Firestore instance, reading config from `NEXT_PUBLIC_FIREBASE_*` env vars
- `firestore.rules` and `firestore.indexes.json` added to repo root (or `apps/web/`), committed like migrations

---

## Data Migration

A one-off script (Node/TS, `firebase-admin` + `pg`) reads every Postgres table and writes Firestore documents per the schema above, including creating `chapterNumbers` marker docs for every existing chapter number. Run once. Postgres is left in place afterward as a read-only backup — not deleted, not part of the running app.

---

## Docs to Update (post-implementation)

- `CLAUDE.md` — Architecture, Commands, DB Conventions, Key Constraints sections all currently describe Go + Postgres
- `docs/ai/CONTEXT.md` — stack table, folder structure, API routes, migrations list
- `docs/engineering/DECISIONS.md` — new ADR superseding ADR-002; note on ADR-003 regarding open Firestore rules until Phase 5
- `docs/engineering/PROGRESS.md` — phase/status tracker
