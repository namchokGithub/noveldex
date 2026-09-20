# Firebase / Firestore read audit

Audit of Firestore read usage across the app (queries, listeners, hooks, repositories, pages), focused on list/detail/search flows. Goal: cut unnecessary reads without changing business logic, UX, ordering, filters, permissions, or schema.

Runtime: Next.js App Router + `firebase/firestore/lite` (no realtime SDK — see below). Domain access lives in `libs/firebase/*`; `libs/api/index.ts` re-exports it. See `docs/ai/CLAUDE.md` for the data model.

Status legend: `[x]` done this session · `[ ]` open, prioritized for a future session · `(rejected)` considered and intentionally not done, with reason.

## Baseline facts (apply to the whole app)

- **No `onSnapshot` anywhere** (`grep -rn onSnapshot app components libs` → 0 hits). The app uses `firebase/firestore/lite`, which doesn't even expose realtime listeners. There is nothing to trim on that axis, and nothing should be added — realtime behavior isn't part of the current design (guest users only read).
- **Firestore-level pagination:** `getTagsPage` (`libs/firebase/tags.ts:42`) and `getVolumesPage` (`libs/firebase/volumes.ts`) use bounded cursor queries. The Character list remains an in-memory pagination concern (H6).
- **Firebase Lite 11.10 aggregation constraint:** the installed public `firebase/firestore/lite` entry point does **not** export `getCountFromServer` or `getAggregateFromServer`. This was verified by TypeScript compilation. Current Firebase documentation describes aggregation APIs for newer SDK surfaces, but this audit must plan against the pinned `firebase ^11.10.0` runtime. Do not add full-SDK aggregation imports to work around this: Cloudflare Workers depend on Lite modules.
- **Global search is one eager client-side MiniSearch index** (`libs/search/SearchIndexProvider.tsx`, mounted once in `app/layout.tsx`), built by `loadSearchDataset()` (`libs/search/loader.ts`), which walks **every novel → every volume/chapter/note/character/entity/event/adaptation** on first page load. This is the intentional Phase 3 architecture (`docs/ai/AGENTS.md`: "one derived client-side MiniSearch index... do not add Firestore full-text queries, an HTTP search endpoint, or a second authoritative datastore"), so it is **not** being redesigned here, but it is the single largest read-cost driver in the app and is called out explicitly below.
- Tests were run against the local Firestore/Auth emulator (`corepack pnpm run emulators`) before and after this session's edits. Baseline had 4 pre-existing failures in `libs/firebase/chapters.test.ts` (mention auto-link / legacy-notes assertions) unrelated to Firestore reads; they fail identically with and without this session's changes, so they're not a regression. Everything else (164 tests) passes; `tsc --noEmit` and `pnpm lint` are clean.

---

## High priority

### H1 — `[x]` Adaptation detail page read the same chapter data twice

**Page:** `app/novels/[id]/volumes/[volumeId]/adaptations/[adaptationId]/page.tsx`
**Was:** fetched `getVolume(id, volumeId)` _and_ `getChaptersByVolume(id, volumeId)` in the same `Promise.all`. `getVolume` internally calls `volumeAggregates()`, which does a full `getDocs(chaptersCol(...))` read of every chapter in the volume just to compute `chapter_count`/`read_count` (`libs/firebase/volumes.ts:101-107`) — fields the page never renders (only `volume.number`/`volume.title` are used). `getChaptersByVolume` reads the same chapter subcollection again, plus tags and note-reference hydration.
**Fix:** swapped to `getVolumeMetadata(id, volumeId)`, the existing lighter accessor that skips the aggregate (and thus the extra chapter read) entirely.
**Impact:** removes one full read of the volume's chapter subcollection on every adaptation-detail page view — scales with chapters-per-volume, not with anything the page shows.

### H2 — `[x]` Chapter detail page fetched the chapter twice per request

**Page:** `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx`
**Was:** `generateMetadata` and the page component each independently call `getChapter(id, volumeId, chapterId)`. Next.js does not dedupe plain async calls across these two entry points, so every chapter view did the full `getChapter` work (doc read + `getTags(novelId)` + note-reference hydration + `getCharactersByIds`) **twice**.
**Fix:** wrapped `getChapter` in a request-scoped `cache()` (`react`) _locally inside this server-only route file_ — `const getChapterCached = cache(getChapter)` — and used it in both places. Deliberately **not** changed in `libs/firebase/chapters.ts`/`libs/api`: `ChapterEditor.tsx` (a client component) also imports and calls `getChapter` directly after mutations to refresh its local state, and it must always get a fresh read there. Wrapping the shared export would have made that stale (client-side `cache()` has no per-request reset), so the fix is scoped to the one server file where the duplication actually happens.
**Impact:** halves the Firestore reads for every chapter-detail page view (the app's most detail-heavy page).

### H3 — `[x]` Volume detail page read the tags collection twice per request

**Page:** `app/novels/[id]/volumes/[volumeId]/page.tsx`
**Was:** the page calls `getTags(id)` directly (for `availableTags`) _and_ `getChaptersByVolume(id, volumeId)`, which internally calls `getTags(novelId)` again (`libs/firebase/chapters.ts`, `tagsForChapter`/`getChaptersByVolume`) to resolve each chapter's `tag_ids`. Two independent full reads of the same small collection, every volume view.
**Fix:** `getChaptersByVolume` now accepts an optional `tags?: Tag[] | Promise<Tag[]>` parameter (mirrors the existing pattern already used by `getEvents(novelId, characterNameById?)` in `libs/firebase/events.ts`). The page creates one `getTags(id)` promise and passes it to both consumers, so the collection is read once.
**Impact:** removes one duplicate tags-collection read per volume-detail view. Backward compatible — every other caller of `getChaptersByVolume` (adaptation detail page, `validateChapterIds`) is unaffected since the parameter is optional.

### H4 — `[x]` Mention resolution re-read the whole characters/entities collection per `[[mention]]`

**Files:** `libs/entities/firestoreLookup.ts`, `libs/entities/reconcile.ts`, `libs/entities/references.ts`
**Was:** `resolveReferenceOccurrences` calls `lookup.findByName` **once per `[[mention]]` token** with no memoization, and each call re-ran `getAllCharacters(novelId)` (character mentions) or `getEntities(novelId, type)` (typed mentions) from scratch. A single note with 5 character mentions triggered 5 full reads of the characters collection; a chapter with several such notes multiplied that further. This runs whenever `reconcileReferenceOccurrences` has to resolve new/changed text — i.e. on every `createChapter`/`updateChapter`/`createAdaptation`/`updateAdaptation`/`updateEvent` call with note or description content, and on read for any legacy note that predates the cached `references` field.
**Fix:** `firestoreEntityLookup()` now memoizes the `getAllCharacters`/`getEntities` promise per `(novelId, type)` for the lifetime of one lookup instance, so N mentions of the same type share one collection read instead of N. No change to matching/resolution semantics — verified against `libs/entities/reconcile.test.ts`/`references.test.ts` (all passing).
**Impact:** turns O(mentions) reads into O(distinct entity types actually referenced) — typically 1–2 — for any single note/chapter/adaptation/event write or legacy-note hydration.
**Follow-up not done (see M6):** this only dedupes _within_ one lookup instance. `getChaptersByVolume`/`getChaptersFlatDetailed` still create a fresh lookup per chapter in their per-chapter loop, so cross-chapter dedup on a volume/novel-wide read would need hoisting one lookup instance up to the caller — bigger surface area, tracked below instead of done opportunistically.

### H5 — `[x]` Volume list reads a bounded page from stored counters

**Page:** `app/novels/[id]/page.tsx` → `getVolumesPage(novelId, { page, perPage, after, before })`.
**Fix:** each normal request reads exactly one Novel document for `volume_count`, `chapter_count`, and `read_count`, then a single ordered Volume query limited to `per_page`. The query orders by `number` then document ID; opaque `{ number, id }` cursors make duplicate Volume numbers deterministic in both directions. The page renders stored Volume and Novel counters directly and never queries the Chapters collection.
**Impact:** list reads are `1 Novel + at most per_page Volumes`, instead of every Volume and every Chapter in the Novel.

**Counter semantics:** `chapter_count` and `read_count` include only entries whose `kind` is `"chapter"`. A regular Chapter contributes to `read_count` only when `read_at` is non-null. Special entries such as Prologue retain their Date Read value for display, but never affect either counter.

#### Production counter migration record

| Field | Record |
| --- | --- |
| Production migration date | 2026-09-20 (record prepared) |
| Project identifier | Pending — do not record credentials |
| Maintenance window | Pending approval |
| Dry-run mismatches | Pending execution |
| Apply writes | Pending execution |
| Verify result | Pending execution |
| Post-write smoke verification | Pending execution |

This record is intentionally pending: no production maintenance window, Firebase Admin backfill, deployment, or post-write smoke sequence has run yet. Fill the remaining fields only after `--dry-run`, `--apply`, and `--verify` complete inside the approved maintenance window.

### H6 — `[ ]` Character list has the same pagination illusion

**Page:** `app/novels/[id]/characters/page.tsx` → `getCharacters(novelId, { page, perPage })` (`libs/firebase/characters.ts:285-310`)
**Current behavior:** identical shape to H5 — `chapterCountsByNovel()` (`characters.ts:140-151`) reads **every chapter in the novel** via `collectionGroup("chapters") where novel_id == X` just to compute each character's `chapter_count`, even though only `perPage` (default 10) characters are shown per page.
**Next decision:** separately choose and maintain a Character counter strategy before changing this reader. Do not add a full-SDK import only for this list.

### H7 — `[x]` Defer the global search index until the command palette opens

**File:** `libs/search/SearchIndexProvider.tsx` (mounted in `app/layout.tsx`), data via `libs/search/loader.ts`
**Was:** on first render of _any_ page (including the plain `/novels` list), a `requestAnimationFrame` callback kicked off `loadSearchDataset()`, which calls `getNovels()` then, **for every novel**, `getVolumesFlat` + `getChaptersFlatDetailed` (full chapter docs incl. notes) + `getAllCharacters` + `getEntities` + `getEvents` + `getAdaptationsForNovel` — i.e. the full Novel → Volume → Chapter → Notes tree for the whole library, every session, whether or not the visitor ever opens the command palette or a search-dependent page.
**Confirmed non-issues:** the provider is mounted once at the root layout (not per-page/per-navigation), so it does **not** rebuild on route changes — that part is already correct. No client component re-reads this data after the initial build; mutations go through `upsert`/`discard` on the in-memory index, not a refetch.
**Fix:** `SearchIndexProvider` now exposes idempotent `start()`. `CommandPalette` invokes it immediately before every palette open path (trigger event and Ctrl/Cmd shortcut both converge there). The existing loading state remains visible while the first build runs; later opens reuse the in-memory index.
**Impact:** ordinary page visits do not load the full catalog. Search results and cross-novel scope stay unchanged once search is opened.

---

## Medium priority

### M1 — `[x]` Novel detail page no longer loads characters for a tracked-count chip

**Page:** `app/novels/[id]/page.tsx`
**Fix:** Done: the Explore card displays static navigation help; `/novels/:id` no longer reads the characters collection.
**Impact:** This concern is closed independently of the Volume counter strategy; no character counter is needed for the Novel detail page.

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

### M6 — `[x]` Cross-chapter entity-lookup memoization (follow-up to H4)

**Fix:** `getChaptersByVolume` and `getChaptersFlatDetailed` each create one `firestoreEntityLookup()` and pass it into all legacy-note hydrations in their bulk mapping. `getChapterNotesForEntity` does not hydrate references, so it never created a lookup and needs no change.
**Impact:** legacy/un-backfilled notes retain identical resolution while each entity type is read once per bulk operation, rather than once per chapter.

### M7 — `[x]` `validateChapterIds` reads full chapter detail just to check membership

**File:** `libs/firebase/adaptations.ts` (`validateChapterIds`), called from `createAdaptation`/`updateAdaptation`
**Fix:** `chapterIdsForVolume()` reads the chapters collection directly and returns document IDs only; `validateChapterIds` retains deduplication and the same cross-volume error.
**Impact:** creating or updating an adaptation no longer performs tag hydration or legacy reference resolution merely to validate membership.

---

## Low priority / no action needed

- **`getTagsPage`** (`libs/firebase/tags.ts:42`) already does correct cursor-based pagination (`limit()` + `startAfter()`). Good existing pattern — cited as the model for any future paginated accessor.
- **`getEvents(novelId, characterNameById?)`** (`libs/firebase/events.ts:230-247`) already accepts a pre-loaded character-name map from callers (e.g. Timeline) specifically to avoid a second full characters read, with a comment explaining why. This is the same idiom used to fix H3 — cited as precedent, no action needed.
- **Realtime listeners:** none exist, and `firebase/firestore/lite` doesn't support them at all. Nothing to reduce; nothing should be added without switching off the lite SDK (an explicit ADR-level decision, not something to do incidentally).
- **`AdaptationsPage`** (`app/novels/[id]/adaptations/page.tsx`) loads `getVolumesFlat` + `getChaptersFlat` + `getAdaptationsForNovel` — all novel-wide. This is inherent to a full cross-volume timeline view (the feature's job is to show everything), not incidental over-fetching. No action.

---

## Summary checklist

| #   | Item                                                                            | Priority | Status                                           |
| --- | ------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| H1  | Adaptation detail:`getVolume` → `getVolumeMetadata`                             | High     | ✅ Done                                          |
| H2  | Chapter detail: dedupe`getChapter` via request-scoped `cache()`                 | High     | ✅ Done                                          |
| H3  | Volume detail: share one`getTags()` read with `getChaptersByVolume`             | High     | ✅ Done                                          |
| H4  | Memoize entity/character lookups inside`firestoreEntityLookup()`                | High     | ✅ Done                                          |
| H5  | Volume list: bounded cursor page from stored counters                            | High     | ✅ Done                                          |
| H6  | Character list: choose a separate maintained counter strategy                    | High     | ⬜ Open                                          |
| H7  | Search index: lazy-start instead of eager root-layout load                      | High     | ✅ Done                                          |
| M1  | Novel page: removed tracked-character count read                                | Medium   | ✅ Done                                          |
| M2  | `getEventsForCharacter`/`getEventsForEntity` full-collection reads              | Medium   | ⬜ Open (fix requires schema change — see notes) |
| M3  | Cache`getCharacterRoles()` (tiny, global, rarely changes)                       | Medium   | ⬜ Open                                          |
| M4  | Time-based cache for`getNovels()` and similar reference reads                   | Medium   | ⬜ Open                                          |
| M5  | `getAdaptationsForNovel` on character/entity detail pages                       | Medium   | ⬜ Open                                          |
| M6  | Hoist entity lookup across chapters (follow-up to H4)                           | Medium   | ✅ Done                                          |
| M7  | `validateChapterIds` avoids chapter hydration for membership checks             | Medium   | ✅ Done                                          |

No schema changes were made or proposed as required. All "Done" items preserve existing ordering, filters, permissions, and output shape — verified with `tsc --noEmit`, `pnpm lint`, and the full test suite against the local emulator (same 4 pre-existing, unrelated failures before and after).
