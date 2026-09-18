# Firebase / Firestore read audit

Audit of Firestore read usage across the app (queries, listeners, hooks, repositories, pages), focused on list/detail/search flows. Goal: cut unnecessary reads without changing business logic, UX, ordering, filters, permissions, or schema.

Runtime: Next.js App Router + `firebase/firestore/lite` (no realtime SDK — see below). Domain access lives in `libs/firebase/*`; `libs/api/index.ts` re-exports it. See `docs/ai/CLAUDE.md` for the data model.

Status legend: `[x]` done this session · `[ ]` open, prioritized for a future session · `(rejected)` considered and intentionally not done, with reason.

## Baseline facts (apply to the whole app)

- **No `onSnapshot` anywhere** (`grep -rn onSnapshot app components libs` → 0 hits). The app uses `firebase/firestore/lite`, which doesn't even expose realtime listeners. There is nothing to trim on that axis, and nothing should be added — realtime behavior isn't part of the current design (guest users only read).
- **Only one collection uses real Firestore-level pagination**: `getTagsPage` (`libs/firebase/tags.ts:42`, `limit()` + `startAfter()`), used by the tag picker in `ChapterEditor.tsx`. Every other "paginated" list (`getVolumes`, `getCharacters`) paginates **in memory** after reading the full collection — see High-priority items below.
- **Global search is one eager client-side MiniSearch index** (`libs/search/SearchIndexProvider.tsx`, mounted once in `app/layout.tsx`), built by `loadSearchDataset()` (`libs/search/loader.ts`), which walks **every novel → every volume/chapter/note/character/entity/event/adaptation** on first page load. This is the intentional Phase 3 architecture (`docs/ai/AGENTS.md`: "one derived client-side MiniSearch index... do not add Firestore full-text queries, an HTTP search endpoint, or a second authoritative datastore"), so it is **not** being redesigned here, but it is the single largest read-cost driver in the app and is called out explicitly below.
- Tests were run against the local Firestore/Auth emulator (`corepack pnpm run emulators`) before and after this session's edits. Baseline had 4 pre-existing failures in `libs/firebase/chapters.test.ts` (mention auto-link / legacy-notes assertions) unrelated to Firestore reads; they fail identically with and without this session's changes, so they're not a regression. Everything else (164 tests) passes; `tsc --noEmit` and `pnpm lint` are clean.

---

## High priority

### H1 — `[x]` Adaptation detail page read the same chapter data twice
**Page:** `app/novels/[id]/volumes/[volumeId]/adaptations/[adaptationId]/page.tsx`
**Was:** fetched `getVolume(id, volumeId)` *and* `getChaptersByVolume(id, volumeId)` in the same `Promise.all`. `getVolume` internally calls `volumeAggregates()`, which does a full `getDocs(chaptersCol(...))` read of every chapter in the volume just to compute `chapter_count`/`read_count` (`libs/firebase/volumes.ts:101-107`) — fields the page never renders (only `volume.number`/`volume.title` are used). `getChaptersByVolume` reads the same chapter subcollection again, plus tags and note-reference hydration.
**Fix:** swapped to `getVolumeMetadata(id, volumeId)`, the existing lighter accessor that skips the aggregate (and thus the extra chapter read) entirely.
**Impact:** removes one full read of the volume's chapter subcollection on every adaptation-detail page view — scales with chapters-per-volume, not with anything the page shows.

### H2 — `[x]` Chapter detail page fetched the chapter twice per request
**Page:** `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx`
**Was:** `generateMetadata` and the page component each independently call `getChapter(id, volumeId, chapterId)`. Next.js does not dedupe plain async calls across these two entry points, so every chapter view did the full `getChapter` work (doc read + `getTags(novelId)` + note-reference hydration + `getCharactersByIds`) **twice**.
**Fix:** wrapped `getChapter` in a request-scoped `cache()` (`react`) *locally inside this server-only route file* — `const getChapterCached = cache(getChapter)` — and used it in both places. Deliberately **not** changed in `libs/firebase/chapters.ts`/`libs/api`: `ChapterEditor.tsx` (a client component) also imports and calls `getChapter` directly after mutations to refresh its local state, and it must always get a fresh read there. Wrapping the shared export would have made that stale (client-side `cache()` has no per-request reset), so the fix is scoped to the one server file where the duplication actually happens.
**Impact:** halves the Firestore reads for every chapter-detail page view (the app's most detail-heavy page).

### H3 — `[x]` Volume detail page read the tags collection twice per request
**Page:** `app/novels/[id]/volumes/[volumeId]/page.tsx`
**Was:** the page calls `getTags(id)` directly (for `availableTags`) *and* `getChaptersByVolume(id, volumeId)`, which internally calls `getTags(novelId)` again (`libs/firebase/chapters.ts`, `tagsForChapter`/`getChaptersByVolume`) to resolve each chapter's `tag_ids`. Two independent full reads of the same small collection, every volume view.
**Fix:** `getChaptersByVolume` now accepts an optional `tags?: Tag[] | Promise<Tag[]>` parameter (mirrors the existing pattern already used by `getEvents(novelId, characterNameById?)` in `libs/firebase/events.ts`). The page creates one `getTags(id)` promise and passes it to both consumers, so the collection is read once.
**Impact:** removes one duplicate tags-collection read per volume-detail view. Backward compatible — every other caller of `getChaptersByVolume` (adaptation detail page, `validateChapterIds`) is unaffected since the parameter is optional.

### H4 — `[x]` Mention resolution re-read the whole characters/entities collection per `[[mention]]`
**Files:** `libs/entities/firestoreLookup.ts`, `libs/entities/reconcile.ts`, `libs/entities/references.ts`
**Was:** `resolveReferenceOccurrences` calls `lookup.findByName` **once per `[[mention]]` token** with no memoization, and each call re-ran `getAllCharacters(novelId)` (character mentions) or `getEntities(novelId, type)` (typed mentions) from scratch. A single note with 5 character mentions triggered 5 full reads of the characters collection; a chapter with several such notes multiplied that further. This runs whenever `reconcileReferenceOccurrences` has to resolve new/changed text — i.e. on every `createChapter`/`updateChapter`/`createAdaptation`/`updateAdaptation`/`updateEvent` call with note or description content, and on read for any legacy note that predates the cached `references` field.
**Fix:** `firestoreEntityLookup()` now memoizes the `getAllCharacters`/`getEntities` promise per `(novelId, type)` for the lifetime of one lookup instance, so N mentions of the same type share one collection read instead of N. No change to matching/resolution semantics — verified against `libs/entities/reconcile.test.ts`/`references.test.ts` (all passing).
**Impact:** turns O(mentions) reads into O(distinct entity types actually referenced) — typically 1–2 — for any single note/chapter/adaptation/event write or legacy-note hydration.
**Follow-up not done (see M6):** this only dedupes *within* one lookup instance. `getChaptersByVolume`/`getChaptersFlatDetailed` still create a fresh lookup per chapter in their per-chapter loop, so cross-chapter dedup on a volume/novel-wide read would need hoisting one lookup instance up to the caller — bigger surface area, tracked below instead of done opportunistically.

### H5 — `[ ]` Volume list pagination reads every chapter in the novel regardless of page size
**Page:** `app/novels/[id]/page.tsx` → `getVolumes(novelId, { page, perPage })` (`libs/firebase/volumes.ts:164-218`)
**Current behavior:** the novel page shows 5 volumes per page, but `getVolumes` always runs `getDocs(query(collectionGroup(db,"chapters"), where("novel_id","==",novelId)))` — **every chapter in the entire novel** — to compute `chapter_count`/`read_count` per volume and the page's summary tiles. Read cost is `O(total chapters in the novel)`, independent of `perPage`. For a novel with, say, 300 chapters, viewing any page of the 5-per-page volume list reads all 300 chapter docs.
**Proposed optimization:** the `firebase/firestore/lite` SDK does support aggregation (`getCount`/`getAggregate`, confirmed present in the installed `firebase@11.10.0` package). Replace the full collectionGroup scan with:
  - one `getCount()` over `collectionGroup("chapters") where novel_id == X` for the novel-wide `total_chapters` summary, and one more with an additional `read_at != null` filter for `read_count` (needs a composite index check), **or**
  - per-displayed-volume `getCount()` calls scoped by `volume_id` (bounded by `perPage`, max 50) for the page's row-level counts.
**Why not done now:** this changes the aggregation strategy (not just a call-site swap), needs a composite-index check for the `read_at`-based count, and touches `libs/firebase/volumes.test.ts`. Higher effort/risk than the fixes above; flagging for a dedicated pass rather than bundling into this session.
**Estimated impact:** turns an O(all chapters) read into O(1–2) aggregation reads for the summary, and O(perPage) cheap aggregation reads for per-row counts — the single biggest remaining win for novels with large chapter counts.

### H6 — `[ ]` Character list has the same pagination illusion
**Page:** `app/novels/[id]/characters/page.tsx` → `getCharacters(novelId, { page, perPage })` (`libs/firebase/characters.ts:285-310`)
**Current behavior:** identical shape to H5 — `chapterCountsByNovel()` (`characters.ts:140-151`) reads **every chapter in the novel** via `collectionGroup("chapters") where novel_id == X` just to compute each character's `chapter_count`, even though only `perPage` (default 10) characters are shown per page.
**Proposed optimization:** same approach as H5 — `getCount()` per displayed character with `where("character_ids","array-contains",characterId)`, instead of one full novel-wide chapter scan. Bundle with H5 since both fixes share the same aggregation-query pattern and the same test/index verification work.
**Estimated impact:** same shape as H5 — O(all chapters) → O(perPage) cheap aggregation reads.

### H7 — `[ ]` Global search index eagerly loads the entire library on first paint
**File:** `libs/search/SearchIndexProvider.tsx` (mounted in `app/layout.tsx`), data via `libs/search/loader.ts`
**Current behavior:** on first render of *any* page (including the plain `/novels` list), a `requestAnimationFrame` callback kicks off `loadSearchDataset()`, which calls `getNovels()` then, **for every novel**, `getVolumesFlat` + `getChaptersFlatDetailed` (full chapter docs incl. notes) + `getAllCharacters` + `getEntities` + `getEvents` + `getAdaptationsForNovel` — i.e. the full Novel → Volume → Chapter → Notes tree for the whole library, every session, whether or not the visitor ever opens the command palette or a search-dependent page.
**Confirmed non-issues:** the provider is mounted once at the root layout (not per-page/per-navigation), so it does **not** rebuild on route changes — that part is already correct. No client component re-reads this data after the initial build; mutations go through `upsert`/`discard` on the in-memory index, not a refetch.
**Why not changed now:** this is the documented Phase 3 architecture (single derived client-side index, per `docs/ai/AGENTS.md`) and is depended on immediately by many components (`ChapterListWithFilters`, `VolumeManager`, `CommandPalette`, timeline/adaptations pages, etc.). Changing *what* it loads (e.g. scoping to the current novel) would change search's cross-novel UX; changing *when* it loads (e.g. lazy-start on first command-palette open or first search-dependent route, instead of unconditionally at root layout) would reduce cost for sessions that never touch search, without changing results — but several components call `useSearchIndex()` unconditionally and would need to tolerate a longer `"loading"` window. This needs a product decision, not a silent behavior change, so it's documented here rather than implemented.
**Estimated impact:** this is the largest single cost driver in the app and the one most likely to matter as the library grows — it scales with **total content across every novel**, not the page being viewed, and re-runs on every fresh session/hard refresh for every visitor (guest reads are public per ADR-012).

---

## Medium priority

### M1 — `[ ]` Novel detail page loads every character just to show a count
**Page:** `app/novels/[id]/page.tsx:41-45`
**Current:** `getAllCharacters(id)` (full characters collection) is fetched only to render `characters.length` in the "trackedCast" chip.
**Proposed:** replace with a `getCount()` aggregation query, or drop the eager fetch and let the Characters page own that count.
**Impact:** small in absolute terms (character collections are usually modest), but it's a full collection read purely for a number.

### M2 — `[ ]` `getEventsForCharacter` / `getEventsForEntity` read the full events collection
**File:** `libs/firebase/events.ts:296-322`, used by `characters/[characterId]/page.tsx` and `entities/[entityId]/page.tsx`
**Current:** both read every event in the novel, then filter in memory via `eventsForCharacter`/`eventsForEntity`.
**Investigated fix (rejected — see below):** an `array-contains` query on `character_ids` looked promising since chapters already use that pattern (`characterChapters` in `characters.ts`), but `eventsForCharacter` matches on **`character_ids` OR a resolved `[[mention]]` in `description_references`** (`libs/characterCrossReferences.ts:26-34`). A server-side `array-contains` query would silently drop events that only match via the description-mention path — a real behavior change, not just an optimization. Not safe without also maintaining a denormalized "resolved character ids" array that includes mention-derived ids, which is a schema change.
**Status:** left as-is; events collections are typically small (curated timeline), so priority is Medium rather than High. If this becomes expensive, the right fix is denormalizing resolved mention ids into `character_ids` at write time (schema change, needs its own ADR), not a query-shape change.

### M3 — `[ ]` `getCharacterRoles()` re-reads a tiny global collection on every character-related page
**File:** `libs/firebase/characterRoles.ts`
**Current:** full read of the global `character_roles` collection (documented in the code as "a handful of seeded roles") on every characters list/detail page load — never cached.
**Proposed:** wrap with a short-TTL cache (e.g. `unstable_cache` with `revalidate: 300`) since this is global master data, not per-novel content, and rarely changes. Low effort, low risk, low absolute impact (small doc count) — good quick win for a future pass.

### M4 — `[ ]` No time-based caching on reference-ish reads
**Pages:** `app/novels/page.tsx` (`getNovels()`, marked `export const dynamic = "force-dynamic"`)
**Current:** every request re-reads the full novels collection. Since Firestore SDK calls aren't tracked by Next's `fetch` cache, this is already effectively dynamic on every other page too (the `force-dynamic` export here doesn't change anything relative to pages without it) — so there is no existing caching layer to lean on anywhere in the app.
**Proposed:** wrap `getNovels()` (and similar rarely-changing reads) in `unstable_cache` with a short revalidate window (e.g. 30–60s). Same idea as M3, broader scope. Needs a decision on acceptable staleness since guest and authenticated users share the same public read path (ADR-012).

### M5 — `[ ]` Adaptation lookups on character/entity detail pages are novel-wide
**Pages:** `characters/[characterId]/page.tsx`, `entities/[entityId]/page.tsx`
**Current:** both call `getAdaptationsForNovel(id)` (a `collectionGroup("adaptations")` scan of the whole novel) then filter client-side to the one character/entity via `adaptationsForCharacter`/`adaptationsForEntity`.
**Assessment:** same shape as M2, but adaptation collections are usually the smallest in the data model (episodes/movies, not chapters). Documented for completeness; not worth the risk/effort unless a novel has an unusually large adaptation list.

### M6 — `[ ]` Cross-chapter entity-lookup memoization (follow-up to H4)
**Files:** `libs/firebase/chapters.ts` (`getChaptersByVolume`, `getChaptersFlatDetailed`, `getChapterNotesForEntity`)
**Current:** each of these creates a fresh `firestoreEntityLookup()` per chapter inside their `snapshot.docs.map(...)` loop (via `hydrateNoteReferences`). H4's memoization only helps within one chapter's notes; it doesn't share the characters/entities read across chapters in the same volume/novel-wide call.
**Proposed:** hoist one `firestoreEntityLookup()` instance up to the top of `getChaptersByVolume`/`getChaptersFlatDetailed` and thread it down through `hydrateNoteReferences`, instead of constructing it per chapter.
**Why not done now:** only matters for chapters whose notes lack the cached `references` field (legacy/un-backfilled data — see `docs/ai/CLAUDE.md` on the notes backfill). For already-migrated data this is a no-op today, so it's lower urgency than H4. Touches more call sites and the `chapters.test.ts` suite; scoping as its own change.

### M7 — `[ ]` `validateChapterIds` reads full chapter detail just to check membership
**File:** `libs/firebase/adaptations.ts` (`validateChapterIds`), called from `createAdaptation`/`updateAdaptation`
**Current:** calls `getChaptersByVolume(novelId, volumeId)` — full chapter docs, tags, and note-reference hydration — only to build a `Set` of valid chapter ids for a membership check.
**Proposed:** a lighter query that only reads chapter ids (e.g. `getDocs` on the collection without hydrating notes/tags) would avoid the wasted hydration work. Write-path only, not part of the read-cost priority (list/detail/search) this audit targets first — documented for a future write-path pass.

---

## Low priority / no action needed

- **`getTagsPage`** (`libs/firebase/tags.ts:42`) already does correct cursor-based pagination (`limit()` + `startAfter()`). Good existing pattern — cited as the model for any future paginated accessor.
- **`getEvents(novelId, characterNameById?)`** (`libs/firebase/events.ts:230-247`) already accepts a pre-loaded character-name map from callers (e.g. Timeline) specifically to avoid a second full characters read, with a comment explaining why. This is the same idiom used to fix H3 — cited as precedent, no action needed.
- **Realtime listeners:** none exist, and `firebase/firestore/lite` doesn't support them at all. Nothing to reduce; nothing should be added without switching off the lite SDK (an explicit ADR-level decision, not something to do incidentally).
- **`AdaptationsPage`** (`app/novels/[id]/adaptations/page.tsx`) loads `getVolumesFlat` + `getChaptersFlat` + `getAdaptationsForNovel` — all novel-wide. This is inherent to a full cross-volume timeline view (the feature's job is to show everything), not incidental over-fetching. No action.

---

## Summary checklist

| # | Item | Priority | Status |
|---|------|----------|--------|
| H1 | Adaptation detail: `getVolume` → `getVolumeMetadata` | High | ✅ Done |
| H2 | Chapter detail: dedupe `getChapter` via request-scoped `cache()` | High | ✅ Done |
| H3 | Volume detail: share one `getTags()` read with `getChaptersByVolume` | High | ✅ Done |
| H4 | Memoize entity/character lookups inside `firestoreEntityLookup()` | High | ✅ Done |
| H5 | Volume list: replace novel-wide chapter scan with aggregation counts | High | ⬜ Open |
| H6 | Character list: replace novel-wide chapter scan with aggregation counts | High | ⬜ Open |
| H7 | Search index: consider lazy-start instead of eager root-layout load | High | ⬜ Open (needs product decision) |
| M1 | Novel page: replace `getAllCharacters` count with aggregation | Medium | ⬜ Open |
| M2 | `getEventsForCharacter`/`getEventsForEntity` full-collection reads | Medium | ⬜ Open (fix requires schema change — see notes) |
| M3 | Cache `getCharacterRoles()` (tiny, global, rarely changes) | Medium | ⬜ Open |
| M4 | Time-based cache for `getNovels()` and similar reference reads | Medium | ⬜ Open |
| M5 | `getAdaptationsForNovel` on character/entity detail pages | Medium | ⬜ Open |
| M6 | Hoist entity lookup across chapters (follow-up to H4) | Medium | ⬜ Open |
| M7 | `validateChapterIds` over-fetches for a membership check | Medium | ⬜ Open (write-path) |

No schema changes were made or proposed as required. All "Done" items preserve existing ordering, filters, permissions, and output shape — verified with `tsc --noEmit`, `pnpm lint`, and the full test suite against the local emulator (same 4 pre-existing, unrelated failures before and after).
