# Character Cursor Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/novels/:id/characters` use bounded, bidirectional Firestore cursor pagination while preserving totals and chapter-appearance counts through maintained derived counters.

**Architecture:** Add opaque `{ name, id }` cursors to the existing characters adapter and route, using `orderBy(name, documentId)` with reversed queries for Previous. Store `novels/{novelId}.character_count` and each Character's `chapter_count`; maintain them transactionally from Character and Chapter mutations, then reconcile legacy data with the existing Admin backfill utility.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Firebase Firestore Lite, Firebase Admin backfill utility, Vitest emulator tests.

**Spec:** `docs/superpowers/specs/2026-09-22-character-cursor-pagination-design.md`

## Global Constraints

- Keep Firestore access in `libs/firebase`; presentation components must not issue Firestore queries.
- Preserve the direct Firestore Lite runtime; do not add `getCountFromServer`, a Go API, an HTTP endpoint, or a second datastore.
- Keep `[[Name]]` and existing Character/Chapter data compatible.
- Preserve guest reads and authenticated writes; UI auth gates are not the security boundary.
- Do not run production backfill, deployment, or production writes as part of this change.
- Follow the repository instruction to add/update test files but hand off lint/test/build commands instead of running them.
- Preserve the unrelated existing modification in `docs/ai/AGENTS.md`.

## Review Focus

- Duplicate Character names: forward/backward cursors must not skip or repeat IDs; test in Task 2.
- Malformed or conflicting `after`/`before` URL values: route must reset safely to page 1; test in Task 2.
- Missing Character documents referenced by a Chapter: counter maintenance must not recreate them; test in Task 4.
- Note replacement with unchanged, added, removed, and duplicate character IDs: apply set deltas exactly once; test in Task 4.
- Legacy documents with missing counters: reader/backfill must produce deterministic values instead of `undefined`; test in Tasks 2 and 5.

## File Map

- Modify `libs/firebase/characters.ts`: cursor types/codec, bounded page reader, Character lifecycle counter transactions.
- Modify `libs/firebase/characters.test.ts`: emulator coverage for cursor traversal and Character counters.
- Modify `libs/firebase/chapters.ts`: transactionally maintain Character chapter-count deltas when Chapter character ownership changes.
- Modify `libs/firebase/chapters.test.ts`: create/update/delete counter coverage.
- Modify `libs/firebase/counters.ts`: focused helpers for Character counter deltas and zero-clamped existing-document updates.
- Modify `libs/firebase/novels.ts`: read/write the new `character_count` field in Novel model helpers.
- Modify `app/types.ts`: add `Novel.character_count` and cursor page contracts while preserving `Character.chapter_count`.
- Modify `libs/api/index.ts`: export cursor codec/page APIs used by the route.
- Modify `app/novels/[id]/characters/page.tsx`: parse and resolve opaque cursor query parameters.
- Modify `app/novels/[id]/characters/CharacterList.tsx`: build cursor URLs and use cursor-aware Previous/Next state.
- Modify `app/novels/[id]/characters/page.test.tsx` (create if absent): source-level route contract tests matching the existing volume route test style.
- Modify `scripts/one-off/backfill-denormalized-counters.ts`: derive/reconcile novel character totals and Character chapter totals.
- Modify `scripts/one-off/backfill-denormalized-counters.test.ts`: source-to-target counter tests.
- Modify `docs/engineering/DECISIONS.md`: record the approved Character counter ownership/rollout after implementation is verified.
- Modify `docs/firebase-recheck.md`: close H6 with measured query shape and leave production migration status explicitly pending.

### Task 1: Add counter primitives and Novel/Character data contracts

**Files:**

- Modify: `libs/firebase/counters.ts`
- Modify: `libs/firebase/novels.ts`
- Modify: `app/types.ts`
- Test: `libs/firebase/characters.test.ts`

**Interfaces:**

- Produce `type CharacterCursor = { name: string; id: string }`.
- Produce a `CharacterPage` shape containing `novel`, `items`, `pagination`, `previousCursor`, and `nextCursor` so the route does not issue a second Novel read.
- Produce a helper that applies a character-count delta only to an existing Character reference, with a zero clamp for decrements.

- [ ] **Step 1: Write the failing counter contract tests.** Add emulator assertions that a created Novel defaults `character_count` to `0`, and that the counter helper does not create a missing Character document when asked to decrement it.
- [ ] **Step 2: Run the focused test to verify it fails.** Run `corepack pnpm exec vitest run libs/firebase/characters.test.ts -t "character counter"`; expected failure is the absent field/helper behavior.
- [ ] **Step 3: Implement the minimal contracts.** Extend the `Novel` type, `NovelDoc` mapping, and Novel creation defaults with `character_count: 0`; add the transaction helper in `counters.ts` using `tx.get` then `tx.update` only when the Character exists, clamping the stored number at zero.
- [ ] **Step 4: Run the focused test to verify it passes.** Run the same command; expected result is PASS.

### Task 2: Implement cursor codec and bounded Character page reader

**Files:**

- Modify: `libs/firebase/characters.ts`
- Modify: `libs/firebase/characters.test.ts`
- Modify: `libs/api/index.ts`
- Modify: `app/types.ts`

**Interfaces:**

- `encodeCharacterCursor(cursor: CharacterCursor): string`
- `decodeCharacterCursor(value: string): CharacterCursor | null`
- `resolveCharacterCursorSearch({ after, before }): { after: CharacterCursor | null; before: CharacterCursor | null }`
- `getCharactersPage(novelId, { page, perPage, after, before }): Promise<CharacterPage>`

- [ ] **Step 1: Write failing traversal tests.** Seed a Novel with `character_count` and four Characters, including duplicate names, then assert page 1, page 2 via `nextCursor`, and Previous via `previousCursor` return the exact ID sequences with no duplicate/gap. Assert malformed cursor input returns page 1 and missing stored chapter counters map to zero.
- [ ] **Step 2: Run the focused tests to verify failure.** Run `corepack pnpm exec vitest run libs/firebase/characters.test.ts -t "cursor"`; expected failure is missing codec/page API.
- [ ] **Step 3: Implement cursor pagination.** Replace the list-only `getCharacters` implementation with a query that reads only `limit(perPage)` Character docs, uses ascending order for first/forward pages and descending order for backward pages, reverses backward results for display, maps stored `chapter_count ?? 0`, and derives totals from `getNovel(novelId).character_count ?? 0`. Keep `getAllCharacters` unchanged for search and other callers.
- [ ] **Step 4: Implement strict cursor validation.** Reject non-object JSON, non-finite/missing `name`, empty/path-containing IDs, and invalid `after`/`before` combinations; normalize invalid cursors to page 1. Export the APIs through `libs/api/index.ts`.
- [ ] **Step 5: Run the focused tests to verify pass.** Run the same Vitest command; expected result is PASS, including duplicate-name and malformed-cursor cases.

### Task 3: Wire the route and list UI to opaque cursors

**Files:**

- Modify: `app/novels/[id]/characters/page.tsx`
- Modify: `app/novels/[id]/characters/CharacterList.tsx`
- Create/Modify: `app/novels/[id]/characters/page.test.tsx`

**Interfaces:**

- Route accepts `page`, `per_page`, `after`, and `before` search params and passes resolved cursors to `getCharactersPage`.
- List receives `previousCursor` and `nextCursor` as encoded strings or null and does not query Firestore.

- [ ] **Step 1: Write failing route/list contract tests.** Assert the route source calls `resolveCharacterCursorSearch`, `normalizeCursorPage`, `getCharactersPage`, and `encodeCharacterCursor`; assert the list source uses `buildCursorPageSearch` and resets cursors when page size changes.
- [ ] **Step 2: Run the focused test to verify failure.** Run `corepack pnpm exec vitest run 'app/novels/[id]/characters/page.test.tsx'`; expected failure is missing cursor symbols in the route/list source.
- [ ] **Step 3: Implement route parsing.** Mirror the existing volume route: validate allowed page sizes, resolve `after`/`before`, normalize page based on valid cursor presence, call `getCharactersPage`, and pass encoded cursors to `CharacterList`.
- [ ] **Step 4: Implement list navigation.** Replace numeric page URL construction with `buildCursorPageSearch`; Previous sends `before=previousCursor`, Next sends `after=nextCursor`, and per-page changes clear both cursors. Keep showing/range labels and empty state intact.
- [ ] **Step 5: Run the focused test to verify pass.** Run the same command; expected result is PASS.

### Task 4: Maintain Character chapter counters from Chapter mutations

**Files:**

- Modify: `libs/firebase/chapters.ts`
- Modify: `libs/firebase/chapters.test.ts`
- Modify: `libs/firebase/characters.test.ts`

**Interfaces:**

- Add an internal set-delta helper returning deduplicated `added` and `removed` IDs.
- `createChapter`, `updateChapter` when `notes` changes, and `deleteChapter` update existing Character documents in the same transaction as the Chapter source write.

- [ ] **Step 1: Write failing mutation tests.** Seed two Characters and assert Chapter create increments each once even when notes mention one repeatedly; update notes from A to B decrements A/increments B; delete decrements both; a missing referenced Character is not created.
- [ ] **Step 2: Run the focused tests to verify failure.** Run `corepack pnpm exec vitest run libs/firebase/chapters.test.ts -t "character counter"`; expected failure is unchanged character documents.
- [ ] **Step 3: Implement create/delete deltas.** In Chapter create, apply `+1` to each resolved `character_ids` inside the existing transaction. In delete, read current IDs and apply `-1` before deleting the Chapter.
- [ ] **Step 4: Implement atomic note replacement.** Resolve the next notes outside the transaction as today, then have the transaction re-read the current Chapter before writing, compare persisted IDs to next IDs, and apply only set differences. Retain existing Chapter counter updates and do not alter character counters for title/read/order/tag-only writes.
- [ ] **Step 5: Run focused tests to verify pass.** Run the same command; expected result is PASS for create/update/delete and missing references.

### Task 5: Extend Admin counter reconciliation

**Files:**

- Modify: `scripts/one-off/backfill-denormalized-counters.ts`
- Modify: `scripts/one-off/backfill-denormalized-counters.test.ts`

**Interfaces:**

- Existing `--dry-run`, `--apply`, and `--verify` modes remain stable.
- `counterTargets` returns `novel.character_count` and per-character `chapter_count` targets in addition to existing targets.

- [ ] **Step 1: Write failing reconciliation tests.** Add source fixtures with duplicate Chapter IDs, special/missing references, stale/missing target fields, and assert absolute targets for Novel and Character documents.
- [ ] **Step 2: Run the focused test to verify failure.** Run `corepack pnpm exec vitest run scripts/one-off/backfill-denormalized-counters.test.ts -t "character"`; expected failure is absent target fields.
- [ ] **Step 3: Implement source scan targets.** Extend the returned target types with `characters: Record<string, CharacterCounterTarget>` and, while scanning each Novel's direct Characters and descendant Chapters, count direct Characters and increment each referenced existing Character ID once per Chapter; add reconciliation documents for the Novel and each direct Character ref with merge writes.
- [ ] **Step 4: Preserve idempotency and report counts.** Keep dry-run mismatch reporting, apply bulk-writer behavior, verify exit code, and scanned/write summaries deterministic; do not modify production data from tests.
- [ ] **Step 5: Run focused tests to verify pass.** Run the same command; expected result is PASS.

### Task 6: Maintain Novel character totals and Character lifecycle transactions

**Files:**

- Modify: `libs/firebase/characters.ts`
- Modify: `libs/firebase/characters.test.ts`

**Interfaces:**

- `createCharacter` and `deleteCharacter` update the parent Novel's `character_count` atomically with the Character lifecycle.

- [ ] **Step 1: Write failing lifecycle tests.** Assert create increments `character_count`, repeated reads do not change it, delete decrements it without going negative, and deleting a missing Character is a no-op.
- [ ] **Step 2: Run the focused test to verify failure.** Run `corepack pnpm exec vitest run libs/firebase/characters.test.ts -t "character_count"`; expected failure is unchanged Novel counter.
- [ ] **Step 3: Implement transaction ownership.** Resolve role data before the transaction, create the Character with `chapter_count: 0`, and update the Novel counter in the same transaction. Delete must read both refs in one transaction and clamp the decrement.
- [ ] **Step 4: Run focused tests to verify pass.** Run the same command; expected result is PASS.

### Task 7: Update architecture records and perform handoff verification

**Files:**

- Modify: `docs/engineering/DECISIONS.md`
- Modify: `docs/firebase-recheck.md`

- [ ] **Step 1: Record the approved ownership.** Add the Character counter fields, source-of-truth semantics, transactional mutation ownership, backfill requirement, and rollout sequence to the decisions record without changing existing ADR-013 volume semantics.
- [ ] **Step 2: Close H6 accurately.** Document the bounded query shape (`1 Novel + at most per_page Characters` for the list, plus no Chapter scan), and keep production backfill/deployment status pending until an operator runs it.
- [ ] **Step 3: Run static verification commands for handoff.** The implementer must provide, but per repository instruction not execute here: `corepack pnpm lint`, `corepack pnpm test`, and (because routing/rendering changed) `corepack pnpm build`.
- [ ] **Step 4: Inspect the final diff.** Confirm no `.env.local`, credentials, production data, or unrelated `docs/ai/AGENTS.md` changes were modified; report any pre-existing failures separately.
