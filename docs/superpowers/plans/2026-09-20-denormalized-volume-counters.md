# Denormalized Volume Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the novel-wide Chapter scan on `/novels/:id` with maintained Novel/Volume counters and bounded cursor pagination.

**Architecture:** `novels/{novelId}` owns all-volume totals; `volumes/{volumeId}` owns totals for its direct Chapters. Chapter and Volume mutations update these counters atomically with the source write. A Firebase Admin source-of-truth rebuild runs before the reader switches to counters, then cursor pagination reads one Novel and at most `per_page` Volumes.

**Tech Stack:** Next.js App Router, React 19, Firebase 11.10 Firestore Lite, Firebase Admin 14.3, Firestore emulator, Vitest, Cloudflare Workers/Vinext.

**Spec:** `docs/superpowers/plans/2026-09-19-firebase-read-optimize.md`; `docs/firebase-recheck.md`

## Global Constraints

- Keep `firebase ^11.10.0`, Firestore Lite, and Cloudflare Workers compatibility. Do not import browser full Firestore SDK or aggregation APIs.
- Keep the current guest-read/authenticated-write rule. Its recursive authenticated-write match already permits updating a parent Novel or Volume counter in the same client mutation.
- M1 is closed: `/novels/:id` no longer shows a tracked-character count or reads characters. Do not add character counters in this plan; H6 remains separate work.
- A Chapter counts only when `kind === "chapter"`. A regular unread Chapter contributes `{ chapter_count: 1, read_count: 0 }`; a regular read Chapter contributes `{ chapter_count: 1, read_count: 1 }`; every special entry (including `prologue`) contributes zero regardless of `read_at`. A Date Read change only affects `read_count` when it crosses between absent and present on a regular Chapter.
- Run production backfill in a temporary authenticated-write maintenance window. The backfill writes absolute totals; a concurrent client write between source scan and counter write can otherwise create drift.
- Use `corepack pnpm` and emulator-backed tests. Do not run `pnpm build` unless explicitly requested.

## Review Focus

- `read_at` transitions: test `null → date`, `date → null`, and `date → another date`; only the first two alter `read_count`.
- Kind transitions: test regular → prologue and read prologue → regular; both Novel and Volume counters must follow the stored counting rule.
- Volume deletion: test mixed regular/special, read/unread Chapters across more than one deletion batch; each source deletion has one matching Novel delta and `volume_count` changes once.
- Cursor boundary: test duplicate Volume numbers with distinct IDs; forward and previous pages neither skip nor repeat a Volume.
- Backfill: test dry run performs no writes, apply is idempotent, and verify reports missing/wrong fields before apply then zero mismatches after apply.

---

## File Structure

- `docs/engineering/DECISIONS.md` — ADR counter ownership, rollout, and rebuild policy.
- `libs/firebase/counters.ts` — pure Chapter contribution/delta calculations plus atomic counter-reference helpers.
- `libs/firebase/counters.test.ts` — pure counter rule tests.
- `app/types.ts`, `libs/firebase/novels.ts`, `libs/firebase/volumes.ts`, `libs/firebase/chapters.ts` — stored fields and maintained mutation paths.
- `libs/firebase/volumes.test.ts`, `libs/firebase/chapters.test.ts`, `firestore.rules.test.ts` — emulator tests for stored values and allowed parent writes.
- `scripts/one-off/backfill-denormalized-counters.ts` — Firebase Admin `--dry-run`, `--apply`, and `--verify` utility.
- `scripts/one-off/backfill-denormalized-counters.test.ts` — source-to-target backfill calculation tests.
- `app/novels/[id]/page.tsx`, `app/novels/[id]/VolumeManager.tsx` — cursor parameters and bounded page UI.
- `firestore.indexes.json` — deterministic Volume cursor index if the emulator requires it.
- `docs/firebase-recheck.md` — M1 correction now; H5 completion after production proof.

### Task 1: Record counter ownership and remove M1 from the decision scope

**Files:**
- Modify: `docs/engineering/DECISIONS.md`
- Modify: `docs/firebase-recheck.md`
- Modify: `docs/superpowers/plans/2026-09-19-firebase-read-optimize.md`

**Interfaces:**
- Produces: ADR-013 with stored fields `Novel.volume_count`, `Novel.chapter_count`, `Novel.read_count`, `Volume.chapter_count`, and `Volume.read_count`.
- Produces: documented writer-first → maintenance backfill → reader-switch rollout.

- [x] **Step 1: Add ADR-013 with the counter table**

  Add this table to `docs/engineering/DECISIONS.md`:

  | Owner document | Stored fields | Source of truth |
  | --- | --- | --- |
  | `novels/{novelId}` | `volume_count`, `chapter_count`, `read_count` | Descendant Volume documents and regular Chapter documents in the Novel. |
  | `novels/{novelId}/volumes/{volumeId}` | `chapter_count`, `read_count` | Regular Chapter documents directly beneath that Volume. |

  Record the regular/special contribution rule from Global Constraints and state that stored counters are derived data, never the source of truth.

- [x] **Step 2: Record the exact rollout order**

  Document: (1) deploy counter-writing mutations while readers retain current queries, (2) block authenticated client writes for maintenance, (3) dry-run/apply/verify the Admin backfill, (4) deploy counter readers and cursor UI, (5) restore writes, then (6) verify after a create/read/unread/delete Chapter smoke sequence.

- [x] **Step 3: Correct M1 documentation**

  Replace the stale `getAllCharacters(id)` description in `docs/firebase-recheck.md` with: “Done: the Explore card displays static navigation help; `/novels/:id` no longer reads the characters collection.” Mark the summary row Done. In the parent read-optimization plan, replace “H5, H6, and M1” with “H5 and H6”.

- [x] **Step 4: Verify documentation quality**

  Run: `git diff --check -- docs/engineering/DECISIONS.md docs/firebase-recheck.md docs/superpowers/plans/2026-09-19-firebase-read-optimize.md`

  Expected: no whitespace errors and no implication that this work adds character counters.

- [ ] **Step 5: Commit** (not authorized; intentionally deferred)

  ```bash
  git add docs/engineering/DECISIONS.md docs/firebase-recheck.md docs/superpowers/plans/2026-09-19-firebase-read-optimize.md
  git commit -m "docs(firestore): define volume counter strategy"
  ```

### Task 2: Introduce tested counter math and stored fields

**Files:**
- Create: `libs/firebase/counters.ts`
- Create: `libs/firebase/counters.test.ts`
- Modify: `app/types.ts`
- Modify: `libs/firebase/novels.ts`
- Modify: `libs/firebase/volumes.ts`
- Test: `libs/firebase/novels.test.ts`, `libs/firebase/volumes.test.ts`

**Interfaces:**
- Produces: `chapterCounterContribution(chapter): ChapterCounter` and `chapterCounterDelta(before, after): ChapterCounter`.
- Produces: zero-initialized counters for new Novel and Volume documents. Missing legacy fields decode to zero only until Task 5 switches readers.

- [x] **Step 1: Write failing pure tests**

  ```ts
  expect(chapterCounterContribution({ kind: "chapter", read_at: null })).toEqual({ chapter_count: 1, read_count: 0 });
  expect(chapterCounterContribution({ kind: "chapter", read_at: Timestamp.now() })).toEqual({ chapter_count: 1, read_count: 1 });
  expect(chapterCounterContribution({ kind: "prologue", read_at: Timestamp.now() })).toEqual({ chapter_count: 0, read_count: 0 });
  expect(chapterCounterDelta(
    { kind: "chapter", read_at: null },
    { kind: "chapter", read_at: Timestamp.now() },
  )).toEqual({ chapter_count: 0, read_count: 1 });
  ```

- [x] **Step 2: Run the test to verify failure**

  Run: `corepack pnpm exec vitest run libs/firebase/counters.test.ts`

  Expected: FAIL because no counter module or helpers exist.

- [x] **Step 3: Implement pure contribution and delta helpers**

  ```ts
  export type ChapterCounter = { chapter_count: number; read_count: number };

  export function chapterCounterContribution(chapter: { kind?: ChapterKind; read_at?: Timestamp | null }): ChapterCounter {
    return chapter.kind === "chapter"
      ? { chapter_count: 1, read_count: chapter.read_at == null ? 0 : 1 }
      : { chapter_count: 0, read_count: 0 };
  }
  ```

  Implement `chapterCounterDelta` as `after contribution - before contribution`. Keep this module pure; no reads or writes belong in it.

- [x] **Step 4: Persist initial values and types**

  Extend `Novel`, `Volume`, `NovelDoc`, and `VolumeDoc` with their owner fields. `createNovel` writes all three Novel counters as `0`; `createVolume` writes both Volume counters as `0`. Map absent legacy fields to `0` in conversion functions while current readers still use legacy aggregation.

- [ ] **Step 5: Verify** (pure suite, TypeScript, and lint pass; emulator suites blocked by unavailable Firebase Auth emulator)

  Run: `corepack pnpm exec vitest run libs/firebase/counters.test.ts libs/firebase/novels.test.ts libs/firebase/volumes.test.ts`

  Expected: PASS; new source documents initialize all owned fields at zero.

- [ ] **Step 6: Commit** (not authorized; intentionally deferred)

  ```bash
  git add app/types.ts libs/firebase/counters.ts libs/firebase/counters.test.ts libs/firebase/novels.ts libs/firebase/novels.test.ts libs/firebase/volumes.ts libs/firebase/volumes.test.ts
  git commit -m "feat(firestore): initialize novel and volume counters"
  ```

### Task 3: Maintain source and counter writes atomically

**Files:**
- Modify: `libs/firebase/counters.ts`
- Modify: `libs/firebase/chapters.ts`
- Modify: `libs/firebase/volumes.ts`
- Test: `libs/firebase/chapters.test.ts`, `libs/firebase/volumes.test.ts`, `firestore.rules.test.ts`

**Interfaces:**
- Consumes: Task 2 contribution/delta helpers.
- Produces: `increment()` updates to parent refs in the same transaction or batch as the source change.

- [x] **Step 1: Write failing emulator assertions**

  Add cases for regular Chapter create, `read_at` set/clear, kind change, delete, Volume create, and Volume delete. Assert both parent paths after each mutation:

  ```ts
  expect((await getDoc(doc(db, "novels", "n"))).data()).toMatchObject({ chapter_count: 1, read_count: 0 });
  expect((await getDoc(doc(db, "novels", "n", "volumes", "v"))).data()).toMatchObject({ chapter_count: 1, read_count: 0 });
  ```

- [x] **Step 2: Run focused tests to verify failure**

  Run: `corepack pnpm exec vitest run libs/firebase/chapters.test.ts libs/firebase/volumes.test.ts`

  Expected: FAIL at new counter assertions while existing Chapter data behavior remains unchanged.

- [x] **Step 3: Add atomic parent-delta helper**

  Implement a helper accepting a Firestore transaction or write batch, `novelId`, `volumeId`, and `ChapterCounter`. For non-zero values, call `increment(delta.chapter_count)` and `increment(delta.read_count)` on both parent references. Keep `volume_count` outside this helper because only Volume create/delete owns it.

- [x] **Step 4: Extend Chapter mutation paths**

  - `createChapter`: in its current transaction, add the new Chapter contribution after the Chapter and marker writes.
  - `updateChapter`: use a transaction whenever `read_at`, `kind`, `number`, or `custom_label` is present. Read the current Chapter once, calculate the next counted state, apply marker validation, update the Chapter, then apply `chapterCounterDelta`.
  - `deleteChapter`: derive contribution from the current transaction snapshot, delete the Chapter/marker, and apply its negative delta in the same transaction.
  - Title, description, tags, notes, and reorder-only writes retain their direct paths and never change counters.

- [x] **Step 5: Extend Volume mutations**

  - `createVolume`: generate a doc reference, use one batch to set the zero-counter Volume and increment `novel.volume_count`, then retain the existing final `getDoc` return behavior.
  - `deleteVolume`: the existing read already has every deleted Chapter. For each deletion batch, calculate the chunk’s regular/read totals and decrement Novel Chapter/read counters in that same batch. In the final batch, delete the Volume and decrement `novel.volume_count` exactly once. Keep adaptation and chapter-number deletion behavior unchanged.

- [ ] **Step 6: Verify mutation and rule behavior** (counter assertions, TypeScript, lint, and rules pass; four pre-existing Chapter note/mention tests fail in the unfiltered focused command)

  Run:

  ```bash
  corepack pnpm exec vitest run libs/firebase/counters.test.ts libs/firebase/chapters.test.ts libs/firebase/volumes.test.ts firestore.rules.test.ts
  corepack pnpm exec tsc --noEmit
  corepack pnpm exec eslint libs/firebase/counters.ts libs/firebase/chapters.ts libs/firebase/volumes.ts
  ```

  Expected: PASS; guest writes remain rejected and authenticated users can update the parent counters.

- [ ] **Step 7: Commit** (not authorized; intentionally deferred)

  ```bash
  git add libs/firebase/counters.ts libs/firebase/counters.test.ts libs/firebase/chapters.ts libs/firebase/chapters.test.ts libs/firebase/volumes.ts libs/firebase/volumes.test.ts firestore.rules.test.ts
  git commit -m "feat(firestore): maintain volume summary counters"
  ```

### Task 4: Build an idempotent Firebase Admin backfill

**Files:**
- Create: `scripts/one-off/backfill-denormalized-counters.ts`
- Create: `scripts/one-off/backfill-denormalized-counters.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm backfill:denormalized-counters -- --project <id> --dry-run|--apply|--verify`.
- Consumes: source Novel, Volume, and Chapter documents only; stored counters never determine targets.

- [x] **Step 1: Write failing reconciliation tests**

  Test pure `counterTargets(volumes, chapters)` with missing/wrong counters, read and unread regular Chapters, and a read prologue. Assert exact Novel and per-Volume targets; the prologue must not contribute.

- [x] **Step 2: Run the test to verify failure**

  Run: `corepack pnpm exec vitest run scripts/one-off/backfill-denormalized-counters.test.ts`

  Expected: FAIL because the script module and `counterTargets` export do not exist.

- [x] **Step 3: Implement command parsing and source scan**

  Follow existing `scripts/one-off/*` style. Require one of `--dry-run`, `--apply`, or `--verify`, and require `--project <id>` or `FIREBASE_PROJECT_ID`. Use Firebase Admin to scan Novels, each Novel’s Volumes, and each Volume’s Chapters.

- [x] **Step 4: Implement safe mode semantics**

  - `--dry-run`: print scanned document counts and every mismatch; write nothing.
  - `--apply`: use `BulkWriter.set(ref, target, { merge: true })` for the five counters plus `counter_schema_version: 1`. Absolute targets make repeated applies idempotent when source data is unchanged.
  - `--verify`: recompute targets, print path plus expected/actual values for each mismatch, and exit non-zero when any mismatch exists.

  Add this script entry:

  ```json
  "backfill:denormalized-counters": "tsx --env-file=.env.local scripts/one-off/backfill-denormalized-counters.ts"
  ```

- [x] **Step 5: Verify**

  Run:

  ```bash
  corepack pnpm exec vitest run scripts/one-off/backfill-denormalized-counters.test.ts
  corepack pnpm exec tsc --noEmit
  corepack pnpm exec eslint scripts/one-off/backfill-denormalized-counters.ts scripts/one-off/backfill-denormalized-counters.test.ts
  ```

  Expected: PASS; dry-run and verify paths make no writes in tests.

- [ ] **Step 6: Commit** (not authorized; intentionally deferred)

  ```bash
  git add package.json scripts/one-off/backfill-denormalized-counters.ts scripts/one-off/backfill-denormalized-counters.test.ts
  git commit -m "feat(firestore): add counter backfill utility"
  ```

### Task 5: Read bounded Volume pages from stored counters

**Files:**
- Modify: `libs/firebase/volumes.ts`
- Modify: `libs/firebase/volumes.test.ts`
- Modify: `libs/api/index.ts`
- Modify: `app/novels/[id]/page.tsx`
- Modify: `app/novels/[id]/VolumeManager.tsx`
- Modify: `app/novels/[id]/page.test.ts`
- Modify: `firestore.indexes.json`
- Modify: `docs/firebase-recheck.md`

**Interfaces:**
- Produces: `getVolumesPage(novelId, options)` with `{ items, pagination, previousCursor, nextCursor }`.
- Consumes: opaque `{ number, id }` cursors so equal Volume numbers remain deterministic.

- [x] **Step 1: Write failing cursor tests**

  Seed Volume numbers `[1, 2, 2, 3]` with distinct IDs and stored counters. Assert forward two-item pages return `[1, 2a]`, then `[2b, 3]`; the previous cursor returns `[1, 2a]`; no record repeats. Assert the summary comes from the Novel document and no `collectionGroup("chapters")` query runs.

- [x] **Step 2: Run the test to verify failure**

  Run: `corepack pnpm exec vitest run libs/firebase/volumes.test.ts`

  Expected: FAIL because `getVolumes` reads all Volume and Chapter documents and no cursor API exists.

- [x] **Step 3: Implement deterministic cursor queries**

  Implement `getVolumesPage` with `orderBy("number", "asc")`, `orderBy(documentId(), "asc")`, and `limit(perPage)`. Query Previous pages in descending order from the current first tuple, then reverse results for rendering. Read the Novel document once for stored summary fields and derive `total_pages` from `volume_count`.

  Encode/decode `{ number, id }` only. Malformed cursor values return the first page. Add the `number ASC, __name__ ASC` Volume index to `firestore.indexes.json` if the emulator reports a missing-index error.

- [x] **Step 4: Update page and manager navigation**

  Retain `page` and `per_page` for visible copy. Generate `after` from `nextCursor` and `before` from `previousCursor`; clear both when page size changes. Render stored Volume and Novel counters directly. Remove the former all-Novel Chapter aggregation call.

- [ ] **Step 5: Verify bounded reads** (page/pure tests, TypeScript, and lint pass; emulator cursor suite remains blocked by unavailable local Auth/Firestore emulator)

  Run:

  ```bash
  corepack pnpm exec vitest run libs/firebase/volumes.test.ts app/novels/[id]/page.test.ts
  corepack pnpm exec tsc --noEmit
  corepack pnpm exec eslint libs/firebase/volumes.ts app/novels/[id]/page.tsx app/novels/[id]/VolumeManager.tsx
  ```

  Expected: PASS. `/novels/:id` reads one Novel and no more than `per_page` Volume documents; it does not query Chapters.

- [x] **Step 6: Update audit**

Commit intentionally deferred because it is not authorized.

  Mark H5 Done with the exact new read shape; leave H6 open as a separate character-counter decision.

  ```bash
  git add libs/firebase/volumes.ts libs/firebase/volumes.test.ts libs/api/index.ts app/novels/[id]/page.tsx app/novels/[id]/VolumeManager.tsx app/novels/[id]/page.test.ts firestore.indexes.json docs/firebase-recheck.md
  git commit -m "perf(volumes): paginate with stored counters"
  ```

### Task 6: Perform the production migration with verification evidence

**Files:**
- Modify: `docs/firebase-recheck.md`

**Interfaces:**
- Consumes: Task 4 backfill utility and Task 5 reader deployment.
- Produces: recorded dry-run/apply/verify evidence without secrets.

- [ ] **Step 1: Begin the approved write-maintenance window**

  Temporarily prevent authenticated client writes using the project’s approved operational controls. Firebase Admin remains authorized for the backfill.

- [ ] **Step 2: Dry run, apply, and verify**

  ```bash
  corepack pnpm backfill:denormalized-counters -- --project <production-project-id> --dry-run
  corepack pnpm backfill:denormalized-counters -- --project <production-project-id> --apply
  corepack pnpm backfill:denormalized-counters -- --project <production-project-id> --verify
  ```

  Expected: dry run reports targets, apply completes, and verify exits zero. Stop before apply if malformed source values are reported.

- [ ] **Step 3: Deploy readers, reopen writes, and verify post-write behavior**

  Open a multi-page Novel, verify Overview totals and Previous/Next navigation, then create a regular Chapter, mark it read, clear it, and delete it. Run `--verify` again and require zero drift.

- [ ] **Step 4: Record and commit outcome**

  Record production date, project identifier, dry-run mismatch count, apply count, and final verification result in the audit; do not record credentials.

  Progress: record prepared on 2026-09-20. Operational values remain pending until the approved maintenance window completes; do not mark this step complete from documentation alone.

  ```bash
  git add docs/firebase-recheck.md
  git commit -m "docs(firestore): record counter migration verification"
  ```

## Execution Order

1. Lock ADR and M1 status.
2. Ship and test math/types.
3. Ship and test atomic writers while legacy readers remain active.
4. Add the rebuild utility.
5. Backfill during maintenance, then deploy bounded readers.
6. Reopen writes and record post-write verification.

## Verification Checklist

- [ ] Run counter, chapter, volume, cursor, backfill, and rules tests with Firestore/Auth emulators available.
- [ ] Run `corepack pnpm exec tsc --noEmit`, focused ESLint, and `git diff --check`; do not run a build unless explicitly requested.
- [ ] Prove guest writes fail and authenticated parent-counter writes succeed.
- [ ] Prove normal Volume-list requests read no Chapter collection and at most `per_page` Volumes after Task 5.
- [ ] Complete production dry-run, apply, verify, and post-write verify inside the maintenance window.
