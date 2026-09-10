# NovelDex — Current Context

## Runtime

The repository root is a Next.js 16 / React 19 application that accesses Cloud Firestore directly through `libs/firebase`. The old Go API and Redis runtime have been removed.

Firestore structure:

- `novels/{novelId}`
- nested `volumes/{volumeId}/chapters/{chapterId}` and `chapterNumbers/{number}`
- nested `characters`, `events`, and `tags`
- global `character_roles`

Chapters carry an embedded `notes[]` list (timestamped entries, `[[Name]]` mention tracking, character auto-linking, pagination) — see ADR-008 in `docs/engineering/DECISIONS.md`. The legacy `summary` field is still populated as a join of note content for older callers; do not remove it without a migration.

`chapters` collection-group queries require the definitions in `firestore.indexes.json`, including the `novel_id` collection-group field override.

## Development

```powershell
corepack pnpm dev
corepack pnpm lint
corepack pnpm test
```

Set Firebase browser configuration in `.env.local`. Use the Firestore emulator by setting `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`; production uses `0` and requires deliberate user approval for writes.

PostgreSQL is only for restoring or inspecting legacy backups. `make db`, `make db-backup`, and `make db-restore` support that recovery path; no application code should depend on it.

## Product boundaries

- Rules are temporarily public until authentication work in Phase 5.
- Full-text search on Firestore is deferred; the command palette must not call an HTTP search endpoint. A client-side scoped quick search (Ctrl+Shift+K) already ships — it matches already-loaded chapters/characters/events and is not full-text search.
- `AddNovelForm` remains disabled by design/pre-existing state.
- See `docs/engineering/PROGRESS.md` for the backlog and `docs/engineering/DECISIONS.md` for architecture rationale.
