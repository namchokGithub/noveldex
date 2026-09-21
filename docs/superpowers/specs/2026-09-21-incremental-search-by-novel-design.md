# Incremental command-palette search by novel

## Goal

Avoid loading the search data for every novel when a user first opens the command palette from a novel route, while keeping one client-side MiniSearch index and zero Firestore reads per keystroke.

## Scope

- Opening the palette on `/novels/{novelId}/...` loads that novel only.
- Chapter, volume, and novel scopes search the current novel's loaded documents.
- Choosing the global scope loads only novels not already added to the session index.
- Opening the palette from a global route loads the global dataset.
- Concurrent requests for the same novel share one in-flight operation.
- Existing mutation updates continue to apply to the one session-wide index.

## Design

`libs/search/loader.ts` will expose a single-novel dataset loader alongside the global loader. The global loader accepts already-loaded novel IDs and only fetches the remaining novel datasets; it may still fetch the novel list to establish global coverage.

`SearchIndexProvider` owns a `loadedNovelIds` set and an in-flight map. It adds a first dataset by building a MiniSearch index, then adds later datasets in chunks to that same index. Loading is serialized with the existing pending mutation queue so an in-flight load cannot lose local mutation updates. A failed novel load is not marked loaded and can be retried.

The provider exposes `ensureNovel(novelId)` and `ensureGlobal()`. `reload()` reloads only the session's loaded novel datasets rather than implicitly fetching the entire database.

`CommandPalette` calls `ensureNovel()` for a novel route and `ensureGlobal()` for a global route when opened. Selecting a wider global scope immediately starts `ensureGlobal()`; the existing loading UI remains visible until global coverage is available.

## Correctness constraints

- Do not add Firestore reads to search keystrokes.
- Do not introduce a second search index, IndexedDB, a Worker, listeners, or an HTTP search endpoint.
- Do not return global results until all novels are represented in the index.
- Documents, entity map, and dependency map remain internally consistent after incremental loads and mutations.

## Verification

- Provider unit tests: deduplicate repeated novel requests, append a second novel into the existing index, and skip loaded novels during global expansion.
- Command palette tests: opening on a novel route requests that novel; selecting global requests global coverage.
- Run lint and the test suite after implementation. The user will run these commands for this change.
