# Entity Cross-reference Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace novel-wide related-record scans on Entity detail pages with a maintained, lazy-loaded inverse-reference index and a safe Admin backfill.

**Architecture:** `novels/{novelId}/entityReferences` is a derived index of resolved Chapter-note, Event-description, and Adaptation-note references. Source adapters replace their own deterministic index entries when a relevant source changes. Entity detail loads only the Entity initially; a client panel later reads one cursor-bounded index page and fetches only Adaptations linked to the matching Chapter IDs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase 11.10 Firestore Lite, Firebase Admin 14.3, Firestore emulator, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-23-entity-cross-reference-index-design.md`

## Global Constraints

- Keep direct Firestore Lite access in `libs/firebase`; do not add an HTTP API, listener, aggregation API, or second datastore.
- Source `references` arrays remain authoritative. The new collection is derived data, not authorization data.
- Preserve guest reads and authenticated writes under the existing recursive Firestore rule.
- Use deterministic index IDs and absolute source-derived backfill targets so retries are safe and idempotent.
- Preserve current direct and Chapter-linked Adaptation cross-reference behaviour.
- Do not run tests, builds, production backfills, deployments, or production writes. Add/update tests and hand off exact commands.
- Do not alter `.env.local`, credentials, or unrelated user changes.

## Review Focus

- Repeated occurrences of one Entity in the same note must produce one related-record entry; test in Task 1.
- An edit which removes the final reference must remove its index document; test in Tasks 2–4.
- A Chapter ID list above Firestore's 30-value `array-contains-any` limit must query in chunks and deduplicate Adaptations; test in Task 1.
- Legacy source documents with missing persisted occurrences must be reconstructed before the index backfill is applied; test in Task 5.
- A user must see no related Firestore query before expanding the panel, and must get a retryable localized error if that query fails; test in Task 6.

---

## File Structure

- `libs/firebase/entityReferences.ts` — index contracts, deterministic IDs, extraction, transactional replacement/deletion, cursor reader, and linked-Adaptation lookup.
- `libs/firebase/entityReferences.test.ts` — pure and emulator behaviour for extraction, pagination, and adaptation merge/chunking.
- `libs/firebase/chapters.ts`, `events.ts`, `adaptations.ts` — maintain index entries with the source mutation.
- corresponding Firebase adapter tests — source lifecycle regression coverage.
- `libs/api/index.ts` — compatibility exports for the client panel.
- `app/novels/[id]/entities/[entityId]/page.tsx` — remove server-side novel-wide related reads.
- `EntityCrossReferences.tsx` — expandable lazy panel, loading/error/pagination UI.
- `firestore.indexes.json` — indexes for the bounded index and linked-Adaptation queries.
- `scripts/one-off/backfill-entity-references.ts` — expand occurrence reconciliation to Events and Adaptations.
- `scripts/one-off/backfill-entity-reference-index.ts` — Admin dry-run/apply/verify source-to-index reconciliation.
- `scripts/one-off/backfill-entity-reference-index.test.ts` — isolated backfill mode/idempotency coverage.
- `package.json`, `docs/engineering/DECISIONS.md` — command and recorded rollout decision.

### Task 1: Define inverse-index contracts and bounded readers

**Files:**

- Create: `libs/firebase/entityReferences.ts`
- Create: `libs/firebase/entityReferences.test.ts`
- Modify: `libs/api/index.ts`
- Modify: `firestore.indexes.json`

**Interfaces:**

- Produce `EntityReference`, `EntityReferenceCursor`, and `EntityReferencePage`.
- Produce `referencesForChapterNotes`, `referencesForEvent`, and `referencesForAdaptationNotes`, each accepting persisted resolved occurrences and emitting one record per Entity/source-note pair.
- Produce `replaceEntityReferences(transaction, novelId, source, next)` and `deleteEntityReferences(transaction, novelId, source)`.
- Produce `getEntityReferencePage(novelId, entityId, cursor)` and `getAdaptationsForChapterIds(novelId, chapterIds)`.

- [ ] **Step 1: Write failing extraction and paging tests.** Seed resolved, unresolved, and duplicate occurrences. Assert one deterministic record for repeated resolved Entity occurrences; assert unrelated Entity IDs do not return; assert a cursor page orders by `updated_at` then document ID. Seed 31 Chapter IDs and assert the linked-Adaptation helper performs two `array-contains-any` queries and returns each matching Adaptation once.
- [ ] **Step 2: Record the expected red command.** Hand off `corepack pnpm exec vitest run libs/firebase/entityReferences.test.ts`; it must fail first because the module does not exist. Do not execute it in this workspace.
- [ ] **Step 3: Implement pure contracts and deterministic IDs.** Use a stable, path-safe encoded ID constructed from source type, source ID, optional note ID, and canonical Entity ID. Extract only occurrences where `token.status === "resolved"`; de-duplicate by Entity ID within one source note. Store source metadata needed for existing links, previews, and order; do not copy rich JSON or unresolved tokens.
- [ ] **Step 4: Implement Firestore reads and writes.** Query direct `entityReferences` with `where("entity_id", "==", entityId)`, `orderBy("updated_at", "desc")`, and `orderBy(documentId(), "desc")`; use `limit(pageSize + 1)` for `hasMore`. Chunk Chapter IDs in groups of 30 for `where("adapted_chapter_ids", "array-contains-any", chunk)` plus `where("novel_id", "==", novelId)`, then deduplicate by Adaptation ID.
- [ ] **Step 5: Add indexes and exports.** Add the direct collection index `(entity_id ASC, updated_at DESC, __name__ DESC)` and the adaptation collection-group `(novel_id ASC, adapted_chapter_ids CONTAINS)` index. Export only read contracts consumed by the Entity UI through `libs/api/index.ts`.
- [ ] **Step 6: Record expected green verification.** Hand off the same Vitest command plus `corepack pnpm exec tsc --noEmit`; expected result is passing deterministic extraction, cursor, and 31-ID chunk tests.

### Task 2: Maintain Chapter-note index entries atomically

**Files:**

- Modify: `libs/firebase/chapters.ts`
- Modify: `libs/firebase/chapters.test.ts`

**Interfaces:**

- Consumes Task 1 `replaceEntityReferences` and `deleteEntityReferences`.
- Produces source-consistent `chapter_note` index entries after `createChapter`, notes-changing `updateChapter`, title/order metadata changes, and `deleteChapter`.

- [ ] **Step 1: Write failing Chapter lifecycle tests.** Create a Chapter whose two notes reference different Entities and verify two index records. Replace the notes so one reference disappears and another is added; assert the old deterministic record is absent and the new one exists. Delete the Chapter and assert all of its records are absent. Add a title update assertion that the indexed title changes without changing Entity IDs.
- [ ] **Step 2: Record the expected red command.** Hand off `corepack pnpm exec vitest run libs/firebase/chapters.test.ts -t "entity reference index"`; it must fail on absent derived documents.
- [ ] **Step 3: Update Chapter create and update transactions.** After `resolveNotes` returns persisted occurrences, build the next `chapter_note` records and apply source write plus replacement inside the existing transaction. For any update that changes notes, title, title locale, sort order, or volume metadata, read the previous source/index set in the same mutation and replace it. Keep tag/read/number semantics and existing character counters unchanged.
- [ ] **Step 4: Update Chapter deletion.** Delete the Chapter's deterministic index entries in the existing deletion transaction before deleting its source document and marker. Preserve existing cascade/counter behavior.
- [ ] **Step 5: Record expected green verification.** Hand off the focused command from Step 2; expected result is exact create/replace/delete index convergence with existing Chapter behaviours preserved.

### Task 3: Maintain Event index entries atomically

**Files:**

- Modify: `libs/firebase/events.ts`
- Modify: `libs/firebase/events.test.ts`

**Interfaces:**

- Consumes Task 1 helper.
- Produces source-consistent `event` records for Event create, description/title/order change, and delete.

- [ ] **Step 1: Write failing Event lifecycle tests.** Create an Event description with a resolved generic Entity, verify one `event` index document, replace the description with another Entity, verify exact removal/addition, then delete the Event and verify cleanup. Assert an Event with only unresolved markup produces no index document.
- [ ] **Step 2: Record the expected red command.** Hand off `corepack pnpm exec vitest run libs/firebase/events.test.ts -t "entity reference index"`; it must fail while Event mutations ignore the index.
- [ ] **Step 3: Make Event mutation paths transactional.** Build `description_references` before the transaction as today, then set/update the Event and replace its records in one transaction alongside existing event-counter deltas. Refresh snapshot metadata when title/order changes; skip index work for Event fields that cannot affect displayed metadata or references.
- [ ] **Step 4: Delete Event index entries.** In the existing delete transaction, remove all records owned by that Event before source deletion and preserve counter decrements.
- [ ] **Step 5: Record expected green verification.** Hand off the focused Event Vitest command; expected result is direct-reference lifecycle coverage passes.

### Task 4: Maintain Adaptation-note index entries and linked lookups

**Files:**

- Modify: `libs/firebase/adaptations.ts`
- Modify: `libs/firebase/adaptations.test.ts`

**Interfaces:**

- Consumes Task 1 helper.
- Produces source-consistent `adaptation_note` records; does not duplicate Chapter-linked Adaptations into the index.

- [ ] **Step 1: Write failing Adaptation lifecycle tests.** Update an Adaptation's notes from Entity A to B and assert its `adaptation_note` record changes exactly once. Create/delete coverage must clean records. Add a reader fixture where an Adaptation has no direct note reference but links a matching Chapter ID; assert it is returned by `getAdaptationsForChapterIds`.
- [ ] **Step 2: Record the expected red command.** Hand off `corepack pnpm exec vitest run libs/firebase/adaptations.test.ts -t "entity reference index"`; it must fail before derived entries exist.
- [ ] **Step 3: Transactionalize relevant Adaptation paths.** Retain `validatePayload`, `resolveNotes`, chapter-ID validation, and adaptation counters, but replace direct `updateDoc` usage for notes/title/order fields with a transaction that updates source and its records together. Do not index `adapted_chapter_ids`; Chapter-linked Adaptations are derived by the bounded reader.
- [ ] **Step 4: Delete owned records.** Extend the current delete transaction to remove `adaptation_note` documents and preserve counter behavior.
- [ ] **Step 5: Record expected green verification.** Hand off the focused Adaptation command; expected result is direct and indirect adaptation scenarios pass.

### Task 5: Reconcile legacy occurrences and inverse-index data

**Files:**

- Modify: `scripts/one-off/backfill-entity-references.ts`
- Create: `scripts/one-off/backfill-entity-reference-index.ts`
- Create: `scripts/one-off/backfill-entity-reference-index.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produce `corepack pnpm backfill:entity-references -- --project <id> --dry-run|--apply` for Chapters, Events, and Adaptation notes.
- Produce `corepack pnpm backfill:entity-reference-index -- --project <id> --dry-run|--apply|--verify`.

- [ ] **Step 1: Write failing Admin-shaped reconciliation tests.** Use a fake database containing stale, missing, and orphaned `entityReferences`. Assert dry-run writes nothing, apply creates/updates/deletes until source-derived targets match, verify reports drift with a non-zero outcome, and a second apply produces zero changes. Include legacy Event and Adaptation markup with no `references` field.
- [ ] **Step 2: Record expected red command.** Hand off `corepack pnpm exec vitest run scripts/one-off/backfill-entity-reference-index.test.ts`; it must fail before the index backfill module exists.
- [ ] **Step 3: Expand occurrence backfill safely.** Factor the existing reference-markup resolver into a pure helper used for Chapter notes, Event descriptions, and Adaptation notes. Preserve current `--project` plus exactly-one-mode validation; `--dry-run` must not write.
- [ ] **Step 4: Implement index backfill.** Scan each Novel's Chapters, Events, and volume Adaptations after occurrence reconciliation. Derive target deterministic documents from persisted resolved occurrences. Use `BulkWriter` for apply, compare source target to existing index for dry-run/verify, and delete orphan index documents during apply only. Report scanned sources, target count, creates, updates, deletes, and drift.
- [ ] **Step 5: Add package command and operational docs.** Add `backfill:entity-reference-index` with `tsx --env-file=.env.local`. Document required order: occurrence dry-run/apply, index dry-run/apply/verify, all only in an explicitly approved maintenance window.
- [ ] **Step 6: Record expected green verification.** Hand off the focused backfill Vitest command and `corepack pnpm exec tsc --noEmit`; expected result is idempotent source-to-index reconciliation.

### Task 6: Replace the detail-page scan with lazy, paginated UI

**Files:**

- Modify: `app/novels/[id]/entities/[entityId]/page.tsx`
- Modify: `app/novels/[id]/entities/[entityId]/EntityCrossReferences.tsx`
- Create/Modify: `app/novels/[id]/entities/[entityId]/page.test.tsx`
- Create/Modify: `app/novels/[id]/entities/[entityId]/EntityCrossReferences.test.tsx`

**Interfaces:**

- Consumes Task 1 `getEntityReferencePage` and `getAdaptationsForChapterIds` through `libs/api`.
- Page passes only `novelId` and `entityId` to the panel; it no longer imports any novel-wide related reader.

- [ ] **Step 1: Write failing route/UI tests.** Assert route source does not import or call `getChapterNotesForEntity`, `getEventsForEntity`, or `getAdaptationsForNovel`. Render the panel and assert no adapter call before click; after click, assert loading then grouped direct records plus linked Adaptations. Assert a rejected adapter call shows `FormError` with `userErrorMessage`, and Next loads the following cursor page.
- [ ] **Step 2: Record the expected red command.** Hand off `corepack pnpm exec vitest run 'app/novels/[id]/entities/[entityId]/page.test.tsx' 'app/novels/[id]/entities/[entityId]/EntityCrossReferences.test.tsx'`; it must fail while page data is fetched eagerly.
- [ ] **Step 3: Simplify the Server Component.** Keep `getEntity` and existing not-found handling; remove all three cross-reference calls and their associated props. The initial request must not load Chapters, Events, or Adaptations.
- [ ] **Step 4: Implement expandable client panel.** Use existing card/button styles and i18n keys. On first expansion, request page one; retain results locally, show a loader, retryable `FormError`, and a localized empty result. Render existing links from index snapshots. Next uses the returned cursor; avoid a second request while one is in flight. Guests see identical read-only results.
- [ ] **Step 5: Record expected green verification.** Hand off the focused UI command, `corepack pnpm exec eslint 'app/novels/[id]/entities/[entityId]' libs/firebase/entityReferences.ts`, and `corepack pnpm exec tsc --noEmit`; expected result is lazy, paginated related records without scans.

### Task 7: Record rollout and final handoff

**Files:**

- Modify: `docs/engineering/DECISIONS.md`
- Modify: `docs/engineering/PROGRESS.md` only if a matching outstanding item exists
- Modify: `docs/_complete_logs.md` only if moving a completed matching item

**Interfaces:**

- Produces documented source-of-truth, write-budget, index, backfill, and production rollout constraints.

- [ ] **Step 1: Add an ADR entry.** Record that `entityReferences` is derived from source reference occurrences; state deterministic replacement, direct versus Chapter-linked Adaptation handling, writer-first rollout, maintenance backfill order, and recovery by re-running reconciliation.
- [ ] **Step 2: Reconcile progress documentation.** Check `PROGRESS.md` and `_complete_logs.md`; only move an item if its wording matches this shipped feature. Do not create a speculative completion entry.
- [ ] **Step 3: Inspect final scope.** Hand off `git diff --check` and `git diff --stat`; expected result is no whitespace errors and no `.env.local`, credentials, or unrelated files.
- [ ] **Step 4: Hand off verification commands.** Provide the user these commands without running them:

  ```bash
  corepack pnpm lint
  corepack pnpm test
  corepack pnpm build
  corepack pnpm backfill:entity-references -- --project <id> --dry-run
  corepack pnpm backfill:entity-reference-index -- --project <id> --dry-run
  ```

  State that `--apply`, production deployment, and any maintenance window require explicit operational approval.
