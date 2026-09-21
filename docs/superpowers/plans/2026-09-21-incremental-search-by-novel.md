# Incremental command-palette search by novel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load only the current novel when the command palette opens from a novel route, then expand the same MiniSearch index to all novels only when the user requests global scope.

**Architecture:** Split the search loader into single-novel and global dataset operations. The provider owns loaded/in-flight coverage, builds the first index once, appends later novel datasets in chunks, and keeps mutation operations queued while a dataset append is in progress. The command palette tells the provider which coverage the current route or widened scope requires.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Firebase Firestore Lite, MiniSearch, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-incremental-search-by-novel-design.md`

## Global Constraints

- Keep one session-wide MiniSearch index; do not add IndexedDB, a Worker, listeners, or an HTTP search endpoint.
- Do not issue Firestore reads per search keystroke.
- Do not return global results until all novels are represented in the index.
- Do not run build or tests in this session; the user will run the commands.

## Review Focus

- Opening twice while a novel load is pending must issue one dataset request: covered by provider in-flight deduplication test.
- Loading a second novel must append to the existing index without discarding the first novel: covered by incremental merge test.
- Widening to global after current-novel loading must skip the loaded novel: covered by global expansion test.
- A failed load must remain retryable and must not mark the novel loaded: covered by provider error-state test.
- A mutation arriving during append must be applied after the loaded batch: covered by queued mutation test.

### Task 1: Split the search loader into novel-scoped datasets

**Files:**
- Modify: `libs/search/loader.ts`
- Test: `libs/search/loader.test.ts` (create if absent)

**Interfaces:**
- Produce `loadSearchDatasetForNovel(novelId: string, labels: ChapterKindLabels): Promise<SearchDataset>`.
- Preserve `loadSearchDataset(labels: ChapterKindLabels): Promise<SearchDataset>` for global loading.
- `SearchDataset` contains `{ documents: SearchDocument[]; entityMap: EntityMap; novelIds: string[] }`.

- [ ] **Step 1: Write failing loader tests** for single-novel output and global output that excludes a supplied `loadedNovelIds` set.
- [ ] **Step 2: Run the focused loader tests and confirm the missing exports/behavior fail.** The user runs the command after implementation.
- [ ] **Step 3: Refactor `loadNovel` to accept an already-fetched `Novel`**, so global loading does not fetch each novel document twice. Build the novel document plus the existing volume/chapter/entity/event/adaptation documents into `SearchDataset`.
- [ ] **Step 4: Implement `loadSearchDatasetForNovel`** by calling `getNovel(novelId)` once and delegating to the shared novel builder.
- [ ] **Step 5: Implement global loading with optional `loadedNovelIds`**, calling `getNovels()` once and loading only remaining novel datasets. Merge documents/entity maps and return the loaded IDs.
- [ ] **Step 6: Keep the existing character-name promise sharing** when loading events.
- [ ] **Step 7: Run the focused loader tests and confirm they pass.** Do not run them in this session.

### Task 2: Add incremental coverage and append operations to the provider

**Files:**
- Modify: `libs/search/SearchIndexProvider.tsx`
- Modify: `libs/search/buildIndex.ts`
- Test: `libs/search/SearchIndexProvider.test.tsx`

**Interfaces:**
- Add `ensureNovel(novelId: string): Promise<void>` and `ensureGlobal(): Promise<void>` to `SearchIndexContextValue`.
- Change `start` to `start(novelId: string | null): void`; a non-null ID calls `ensureNovel`, and null calls `ensureGlobal`.
- Keep `reload`, mutation methods, maps, `status`, and `rawSearch` available to existing consumers.

- [ ] **Step 1: Write failing tests** for loaded-ID deduplication, appending documents to an existing index, skipping already-loaded IDs during global expansion, retry after failure, and mutation queue ordering.
- [ ] **Step 2: Run the provider tests and confirm the new coverage behavior fails.** The user runs the command after implementation.
- [ ] **Step 3: Add an async chunked append helper** beside `buildIndexAsync`, using the existing browser-yield pattern so later novels do not monopolize the main thread.
- [ ] **Step 4: Add `loadedNovelIdsRef`, `inFlightNovelLoadsRef`, `globalLoadInFlightRef`, and a serialized dataset-load flag.** Return an existing promise for duplicate novel requests and only mark an ID loaded after its documents and entities are published successfully.
- [ ] **Step 5: Implement first-load and append paths.** Build the first MiniSearch index from the first dataset; append later datasets to the existing index; merge document/entity maps; rebuild dependents; and flush pending mutations after the append completes.
- [ ] **Step 6: Preserve failure behavior.** Reset loading state, retain already-indexed documents, expose the error, and remove failed IDs/promises so a later request retries.
- [ ] **Step 7: Implement `ensureGlobal`** to fetch remaining novels through the loader, await all appends, and only report ready/global coverage after every novel is loaded.
- [ ] **Step 8: Update `reload`** to rebuild only the loaded novel IDs and preserve the same loaded coverage; a failed reload must not silently claim global coverage.
- [ ] **Step 9: Run provider tests and confirm they pass.** Do not run them in this session.

### Task 3: Trigger coverage from route scope and global widening

**Files:**
- Modify: `components/commands/CommandPalette.tsx`
- Test: `components/commands/CommandPalette.test.tsx` (create or extend the existing command-palette test location)

**Interfaces:**
- Consume `start(novelId: string | null)`, `ensureNovel`, and `ensureGlobal` from `useSearchIndex()`.

- [ ] **Step 1: Write failing interaction tests** for opening on a novel route, opening on a global route, and selecting the global widen option.
- [ ] **Step 2: Run the focused command-palette tests and confirm they fail before the wiring change.** The user runs the command after implementation.
- [ ] **Step 3: Call `start(novelId)` from `openPalette`.** Route-derived novel IDs load only that novel; a null route loads global coverage.
- [ ] **Step 4: Replace direct `setScopeOverride` on widen buttons with a handler** that sets the scope and calls `ensureGlobal()` when the selected option is global. Existing novel/volume widening must rely on the current novel already being loaded.
- [ ] **Step 5: Keep `pending` and empty-state behavior accurate** while the requested coverage is loading; no query should produce global results while global coverage is incomplete.
- [ ] **Step 6: Run command-palette tests and confirm they pass.** Do not run them in this session.

### Task 4: Update documentation and verify the complete change

**Files:**
- Modify: `docs/ai/CONTEXT.md`
- Modify: `docs/engineering/DECISIONS.md` (Phase 3 search decision section)

- [ ] **Step 1: Document current-novel-first loading, lazy global expansion, in-flight deduplication, and the one-index invariant.**
- [ ] **Step 2: Run `git diff --check`.**
- [ ] **Step 3: Provide the user with the exact commands to run:**

```bash
corepack pnpm lint
corepack pnpm test
```

- [ ] **Step 4: The user runs lint and the full test suite; address any reported failures before claiming completion.**

