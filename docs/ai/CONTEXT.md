# Novelndex — Current Context

## Runtime

The repository root is a Next.js 16 / React 19 application that accesses Cloud Firestore directly through `libs/firebase`. It uses the Firebase Firestore Lite SDK so the same modules run in Cloudflare Workers; the old Go API and Redis runtime have been removed.

Firestore structure:

- `novels/{novelId}`
- nested `volumes/{volumeId}/chapters/{chapterId}`, `volumes/{volumeId}/chapterNumbers/{number}`, and `adaptations/{adaptationId}`
- nested `characters`, `entities`, `events`, and `tags`; `entities` stores locations, skills, organizations, items, and concepts while characters retain their existing collection
- global `character_roles`

Chapters carry an embedded `notes[]` list with timestamped entries and persisted generic entity-reference occurrences. `[[Name]]` remains a character reference for compatibility; typed references support locations, skills, organizations, items, and concepts. Legacy character fields remain for existing filters and counts. The legacy `summary` field is still populated as a join of note content for older callers; do not remove it without a migration. Volumes carry an optional `description` string (max 1000 characters) and chapters one (max 500 characters), shown only on their detail pages.

Chapter entries use ADR-009: `sort_order` controls reading order only within a volume. Regular `chapter` entries retain a positive `number` unique to that volume and a volume-scoped `chapterNumbers` marker. `prologue`, `epilogue`, `afterword`, `side_story`, and `other` entries store `number: null`; only `other` needs a nonempty `custom_label`. Use `formatChapterLabel` from `libs/chapterLabel.ts` for every user-facing label. When upgrading the marker layout, run `pnpm backfill:volume-chapter-numbers -- --project <id>` first, review the dry-run, then rerun with `--apply`.

Timeline events use story order: `volume.number → chapter.sort_order → page_number → event.sort_order → event.id`. Event `sort_order` is a position only within the same volume, chapter, and page. The Add Event form derives its default as the next position in that group (`max + 1`); it does not renumber existing events when inserting a value in the middle.

Adaptations are owned by a volume at `novels/{novelId}/volumes/{volumeId}/adaptations/{adaptationId}`. Each document denormalizes `novel_id` and `volume_id` for the novel-wide collection-group query; keep those values aligned with its parent path. An embedded timestamped `notes[]` list persists generic story-reference occurrences. `adapted_chapter_ids` may reference only chapters in that same parent volume; do not add a duplicate `adapted_volume_id`. Adaptation `sort_order` is scoped to its volume and medium/group, while the timeline groups entries by volume then medium/group. The collection-group query requires the `adaptations` `novel_id` field override in `firestore.indexes.json` to be deployed before use. The volume detail page renders no aggregate overview: it loads only the latest adaptation through `getLatestAdaptationByVolume` (`updated_at` descending, limit 1), does not query events only to count them, and derives its tag filter from tags referenced by that volume's chapters rather than every novel tag.

User-facing form errors use `FormError` from `app/novels/ui.tsx`. Client code must pass caught Firebase errors through `userErrorMessage` from `libs/userErrorMessage.ts` rather than rendering raw error text.

`chapters` collection-group queries require the definitions in `firestore.indexes.json`, including the `novel_id` collection-group field override.

## Development

```powershell
corepack pnpm dev
corepack pnpm lint
corepack pnpm test
```

Do not run `corepack pnpm build` as routine verification. Run it only when a change affects rendering, routing, dynamic imports, or production behavior directly.

Set Firebase browser configuration in `.env.local`. Use the Firestore emulator by setting `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`; production uses `0` and requires deliberate user approval for writes.

Firestore Lite is REST-only: do not introduce listeners, offline persistence, or full-SDK aggregation calls into `libs/firebase`. The current app uses one-off reads and writes. `getVolumes` derives volume and novel summaries from one volume query plus one returned chapter collection-group query because Lite does not expose `getCountFromServer`; revisit cursor pagination or denormalized counters as novels grow.

PostgreSQL is only for restoring or inspecting legacy backups. `make db`, `make db-backup`, and `make db-restore` support that recovery path; no application code should depend on it.

## Product boundaries

- Phase 5 (ADR-012): Firebase Auth with no self-registration UI. Guest (unauthenticated) reads everything; any authenticated request can write. `isAdmin = user !== null` client-side, read from `useAuth()` in `components/auth/AuthProvider.tsx`; every mutation UI trigger checks it inline.
- Adaptations are a completed Phase 5.1 feature: use the Firestore adapter in `libs/firebase/adaptations.ts`, not ad-hoc UI queries. Cross-volume moves are intentionally unsupported because an adaptation's parent path represents its volume ownership.
- Phase 3 is implementing one derived client-side MiniSearch index fed by Firestore, with generic entity references and global/novel/volume/chapter scopes. The command palette must not call Firestore on each keystroke or call an HTTP search endpoint; Firestore remains the source of truth.
- Phase 3 supplies `libs/search/SearchIndexProvider.tsx`: it mounts once inside `I18nProvider`, builds one session-wide MiniSearch index from `loadSearchDataset`, and keeps separate document/entity/dependency maps because MiniSearch uses `storeFields: []`. It supports serialized incremental add/replace/discard batches, reference-projection refresh, and vacuum maintenance; Thai/English tokenization uses `Intl.Segmenter` with a fallback. `SearchScope`, staged ranking, and debounce live in the command palette. The synthetic benchmark report records the growth checkpoints; do not add IndexedDB or a Worker without renewed benchmark evidence.
- `AddNovelForm` remains disabled by design/pre-existing state.
- See `docs/engineering/PROGRESS.md` for the backlog and `docs/engineering/DECISIONS.md` for architecture rationale.
