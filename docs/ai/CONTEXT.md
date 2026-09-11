# Novelndex — Current Context

## Runtime

The repository root is a Next.js 16 / React 19 application that accesses Cloud Firestore directly through `libs/firebase`. The old Go API and Redis runtime have been removed.

Firestore structure:

- `novels/{novelId}`
- nested `volumes/{volumeId}/chapters/{chapterId}` and `chapterNumbers/{number}`
- nested `characters`, `entities`, `events`, and `tags`; `entities` stores locations, skills, organizations, items, and concepts while characters retain their existing collection
- global `character_roles`

Chapters carry an embedded `notes[]` list with timestamped entries and persisted generic entity-reference occurrences. `[[Name]]` remains a character reference for compatibility; typed references support locations, skills, organizations, items, and concepts. Legacy character fields remain for existing filters and counts. The legacy `summary` field is still populated as a join of note content for older callers; do not remove it without a migration. Volumes and chapters also carry an optional `description` string (max 500 characters), shown only on their detail pages.

Chapter entries use ADR-009: `sort_order` controls reading order only within a volume. Regular `chapter` entries retain their novel-wide unique positive `number` and a `chapterNumbers` marker. `prologue`, `epilogue`, `afterword`, `side_story`, and `other` entries store `number: null`; only `other` needs a nonempty `custom_label`. Use `formatChapterLabel` from `libs/chapterLabel.ts` for every user-facing label, and run `pnpm backfill:chapter-entry-order -- --project <id> --dry-run` before its `--apply` counterpart when upgrading existing Firestore data.

User-facing form errors use `FormError` from `app/novels/ui.tsx`. Client code must pass caught Firebase errors through `userErrorMessage` from `libs/userErrorMessage.ts` rather than rendering raw error text.

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
- Phase 3 is implementing one derived client-side MiniSearch index fed by Firestore, with generic entity references and global/novel/volume/chapter scopes. The command palette must not call Firestore on each keystroke or call an HTTP search endpoint; Firestore remains the source of truth.
- Phase 3 supplies `libs/search/SearchIndexProvider.tsx`: it mounts once inside `I18nProvider`, builds one session-wide MiniSearch index from `loadSearchDataset`, and keeps separate document/entity/dependency maps because MiniSearch uses `storeFields: []`. It supports serialized incremental add/replace/discard batches, reference-projection refresh, and vacuum maintenance; Thai/English tokenization uses `Intl.Segmenter` with a fallback. `SearchScope`, staged ranking, and debounce live in the command palette. The synthetic benchmark report records the growth checkpoints; do not add IndexedDB or a Worker without renewed benchmark evidence.
- `AddNovelForm` remains disabled by design/pre-existing state.
- See `docs/engineering/PROGRESS.md` for the backlog and `docs/engineering/DECISIONS.md` for architecture rationale.
