# NovelDex — Current Context

## Runtime

`web` is a Next.js 16 / React 19 application that accesses Cloud Firestore directly through `web/libs/firebase`. The old Go API and Redis runtime have been removed.

Firestore structure:

- `novels/{novelId}`
- nested `volumes/{volumeId}/chapters/{chapterId}` and `chapterNumbers/{number}`
- nested `characters`, `events`, and `tags`
- global `character_roles`

`chapters` collection-group queries require the definitions in `web/firestore.indexes.json`, including the `novel_id` collection-group field override.

## Development

```powershell
cd web
corepack pnpm dev
corepack pnpm lint
corepack pnpm test
```

Set Firebase browser configuration in `web/.env.local`. Use the Firestore emulator by setting `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`; production uses `0` and requires deliberate user approval for writes.

PostgreSQL is only for restoring or inspecting legacy backups. `make db`, `make db-backup`, and `make db-restore` support that recovery path; no application code should depend on it.

## Product boundaries

- Rules are temporarily public until authentication work in Phase 5.
- Full-text search is deferred; the retired command palette must not call an HTTP search endpoint.
- `AddNovelForm` remains disabled by design/pre-existing state.
- See `docs/engineering/PROGRESS.md` for the backlog and `docs/engineering/DECISIONS.md` for architecture rationale.
