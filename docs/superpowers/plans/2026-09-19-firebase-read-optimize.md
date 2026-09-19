# Firebase Read Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce avoidable Firestore reads while retaining Firestore Lite, Cloudflare Workers compatibility, current search results, ordering, and public-read/authenticated-write behavior.

**Architecture:** Keep `libs/firebase/*` as the sole data-access layer and keep `firebase/firestore/lite` as the runtime SDK. First defer the session-wide MiniSearch load until it is needed, then remove avoidable hydration on write paths and legacy reads. Treat aggregate counts as a separate decision because the pinned Firebase 11.10 Lite public API does not expose them.

**Tech Stack:** Next.js App Router, React 19, Firebase 11.10 Firestore Lite, Cloudflare Workers, Vitest, Firestore emulator.

**Spec:** `docs/firebase-recheck.md`

## Global Constraints

- Keep `firebase ^11.10.0` and `@firebase/rules-unit-testing` 4.x unless a dedicated dependency-upgrade decision is approved.
- Do not import `firebase/firestore` full SDK, add listeners, offline persistence, HTTP search, or a second datastore.
- Keep search results cross-novel and functionally identical once the user opens the command palette.
- Preserve Firestore schema in Tasks 1–4; counters and migrations require a separate approved design.
- Use `corepack pnpm`; test with the local Firestore/Auth emulator before claiming a data-access change is complete.

---

## File Structure

- `docs/firebase-recheck.md` — factual audit and constraints for future read work.
- `libs/search/SearchIndexProvider.tsx` — owns the deferred, session-wide MiniSearch build lifecycle.
- `components/commands/CommandPalette.tsx` — starts the index only when search is opened.
- `libs/search/SearchIndexProvider.test.tsx` — verifies no dataset load before explicit start and exactly one load after it.
- `libs/firebase/adaptations.ts` — replaces heavyweight chapter hydration in adaptation membership validation.
- `libs/firebase/adaptations.test.ts` — protects same-volume validation semantics.
- `libs/firebase/chapters.ts` — shares one reference lookup while hydrating legacy chapter notes in a bulk query.
- `libs/firebase/chaptersLookup.test.ts` — proves legacy notes resolve identically while lookups are shared.
- `docs/engineering/DECISIONS.md` — only changes if an SDK upgrade or denormalized counter design is approved.

### Task 1: Record the Firebase Lite capability boundary

**Files:**

- Modify: `docs/firebase-recheck.md`
- Test: TypeScript compiler import check

**Interfaces:**

- Consumes: public exports from `firebase/firestore/lite` at Firebase 11.10.
- Produces: an audit that does not propose unavailable aggregate APIs as an immediate implementation.

- [x] **Step 1: Add an explicit SDK constraint beneath the audit baseline facts**

  State that the public Lite entry point in Firebase 11.10 does not export `getCountFromServer` or `getAggregateFromServer`, despite newer Firebase documentation describing aggregation APIs.

- [x] **Step 2: Mark H5, H6, and M1 as blocked by that constraint**

  Replace each immediate aggregation proposal with these supported choices: retain current reads, run a dedicated Firebase upgrade plus Cloudflare compatibility test, or design denormalized counters with migration/write maintenance.

- [x] **Step 3: Verify the constraint against the installed SDK**

  Run: `corepack pnpm tsc --noEmit`

  Expected: the codebase compiles without adding any full-SDK aggregation import.

- [ ] **Step 4: Commit**

  ```bash
  git add docs/firebase-recheck.md
  git commit -m "docs(firestore): document Lite aggregation constraint"
  ```

### Task 2: Lazy-start the global MiniSearch dataset (H7)

**Files:**

- Modify: `libs/search/SearchIndexProvider.tsx`
- Modify: `components/commands/CommandPalette.tsx`
- Create: `libs/search/SearchIndexProvider.test.tsx`

**Interfaces:**

- Produces: `start(): void` in `SearchIndexContextValue`.
- Consumes: `start()` from the command palette on every open path (button event and Ctrl/Cmd shortcut).

- [x] **Step 1: Write the failing provider test**

  Mock `loadSearchDataset`, render `SearchIndexProvider`, and assert no call occurs before `start()`; call `start()` twice and assert one dataset load.

  ```ts
  expect(loadSearchDataset).not.toHaveBeenCalled();
  result.current.start();
  result.current.start();
  await waitFor(() => expect(loadSearchDataset).toHaveBeenCalledTimes(1));
  ```

- [x] **Step 2: Run the focused test to verify failure**

  Run: `corepack pnpm vitest run libs/search/SearchIndexProvider.test.tsx`

  Expected: failure because the provider currently schedules `reload()` from its mount effect and does not expose `start()`.

- [x] **Step 3: Implement idempotent `start()` in the provider**

  Replace the mount `requestAnimationFrame(reload)` effect with a callback that checks `hasStartedInitialBuild`, marks it true, and calls `reload()`. Add it to the context value. `reload()` remains available for explicit retry after an error.

- [x] **Step 4: Start before Command Palette search UI is shown**

  In every code path that sets Command Palette `open` to true, invoke `start()`. Preserve the current loading UI while `status === "loading"`; it is expected on first open.

- [x] **Step 5: Verify behavior and regressions**

  Run:

  ```bash
  corepack pnpm vitest run libs/search/SearchIndexProvider.test.tsx
  corepack pnpm tsc --noEmit
  corepack pnpm lint
  ```

  Expected: index has no initial load on ordinary page visits, builds once on first search open, and later opens reuse it.

- [ ] **Step 6: Commit**

  ```bash
  git add libs/search/SearchIndexProvider.tsx components/commands/CommandPalette.tsx libs/search/SearchIndexProvider.test.tsx
  git commit -m "perf(search): defer global index loading until search opens"
  ```

### Task 3: Make adaptation chapter-membership validation lightweight (M7)

**Files:**

- Modify: `libs/firebase/adaptations.ts`
- Modify: `libs/firebase/adaptations.test.ts`

**Interfaces:**

- Replaces: `validateChapterIds()` dependency on `getChaptersByVolume()`.
- Produces: a local `chapterIdsForVolume(novelId, volumeId): Promise<Set<string>>` that reads the chapter collection only and never hydrates tags or note references.

- [x] **Step 1: Write a failing regression test**

  Seed two chapters in one volume and one in another volume. Call `createAdaptation()` with IDs from the matching volume and assert success; call it with the other-volume ID and assert the existing validation error.

- [x] **Step 2: Run the focused test against the emulator**

  Run: `corepack pnpm vitest run libs/firebase/adaptations.test.ts`

  Expected: existing behavior passes before implementation; add a spy/mocked helper assertion that demonstrates `getChaptersByVolume()` is no longer the required path.

- [x] **Step 3: Implement a direct chapter-ID read**

  ```ts
  async function chapterIdsForVolume(novelId: string, volumeId: string) {
    const snapshot = await getDocs(
      collection(db, "novels", novelId, "volumes", volumeId, "chapters"),
    );
    return new Set(snapshot.docs.map((chapter) => chapter.id));
  }
  ```

  Use it only in `validateChapterIds`; preserve deduplication and the same error text.

- [x] **Step 4: Verify the write path**

  Run:

  ```bash
  corepack pnpm vitest run libs/firebase/adaptations.test.ts
  corepack pnpm tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add libs/firebase/adaptations.ts libs/firebase/adaptations.test.ts
  git commit -m "perf(adaptations): avoid chapter hydration during validation"
  ```

### Task 4: Share legacy-reference lookup work across a bulk chapter read (M6)

**Files:**

- Modify: `libs/firebase/chapters.ts`
- Create: `libs/firebase/chaptersLookup.test.ts`

**Interfaces:**

- Consumes: `firestoreEntityLookup()` memoization scoped to one lookup instance.
- Produces: one lookup instance per bulk operation, threaded into `hydrateNoteReferences()` for all chapters in that operation.

- [x] **Step 1: Write a failing legacy-note regression test**

  Seed two chapters with legacy notes containing `[[Rimuru]]`. Assert `getChaptersByVolume()` returns resolved reference occurrences for both notes and use a mocked lookup factory to assert it is created once for the whole operation.

- [x] **Step 2: Run the focused test to verify the new call-count assertion fails**

  Run: `corepack pnpm vitest run libs/firebase/chapters.test.ts`

  Expected: the returned chapter data passes but the factory-call assertion fails because each chapter currently creates its own lookup.

- [x] **Step 3: Thread the lookup through hydration**

  Extend `hydrateNoteReferences` with an optional `EntityLookup` parameter and create one `const lookup = firestoreEntityLookup()` before each bulk `snapshot.docs.map(...)` in `getChaptersByVolume`, `getChaptersFlatDetailed`, and `getChapterNotesForEntity`. Keep single-chapter reads compatible by retaining the default parameter.

- [x] **Step 4: Run focused verification**

  ```bash
  corepack pnpm vitest run libs/firebase/chapters.test.ts libs/entities/reconcile.test.ts
  corepack pnpm tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add libs/firebase/chapters.ts libs/firebase/chapters.test.ts
  git commit -m "perf(chapters): share legacy reference lookup per bulk read"
  ```

### Task 5: Decide the counter strategy before H5, H6, and M1

**Files:**

- Modify: `docs/engineering/DECISIONS.md` only if a strategy is approved
- Modify: `docs/firebase-recheck.md` after the chosen strategy is proven

**Interfaces:**

- Option A: upgrade Firebase and prove `firebase/firestore/lite` supports required aggregate exports in both Next.js and `vinext build`.
- Option B: define denormalized counters and all event/chapter mutation ownership before any schema write.

- [ ] **Step 1: Produce a short decision record comparing the two options**

  Include bundle/Cloudflare compatibility, aggregate query index requirements, migration cost, and the write paths that must maintain counters.

- [ ] **Step 2: If choosing an SDK upgrade, prove the exact public import before touching list code**

  ```ts
  import { getCountFromServer } from "firebase/firestore/lite";
  ```

  Run `corepack pnpm tsc --noEmit` and `corepack pnpm build:cloudflare`. Stop if either fails.

- [ ] **Step 3: If choosing counters, write a separate migration plan first**

  Define exact fields, backfill command, idempotency, create/update/delete maintenance, and Firestore rules/index effects. Do not add counters in this plan.

- [ ] **Step 4: Commit the decision record only**

  ```bash
  git add docs/engineering/DECISIONS.md docs/firebase-recheck.md
  git commit -m "docs(firestore): choose list counter strategy"
  ```

## Execution Order

1. Task 1 — accurate constraints first.
2. Task 2 — largest read reduction with no schema change.
3. Task 3 — contained write-path saving.
4. Task 4 — legacy-data saving; prioritize if backfill has not completed.
5. Task 5 — only after measuring remaining production/emulator read volume.

## Verification Checklist

- [ ] Run `corepack pnpm test` with the Firestore/Auth emulator available.
- [x] Run `corepack pnpm tsc --noEmit` and `corepack pnpm lint`.
- [ ] Open a normal route and verify the search dataset does not load before the palette is opened.
- [x] Open the palette twice and verify one initial index build.
- [x] Create and update an adaptation with valid and invalid chapter IDs.
- [x] Read legacy notes across multiple chapters and verify resolved references remain unchanged.
- [ ] Do not claim aggregate-count work is available until the selected strategy passes both Next.js and Cloudflare builds.
