# Bounded Entity Cross-reference Reads

## Goal

Opening `/novels/:novelId/entities/:entityId` must read the Entity itself and
only records that reference it. It must not read every Chapter, Event, and
Adaptation in the Novel merely to render the related-records section.

The related-records section remains behaviourally compatible: it shows Chapter
notes and Events with a direct resolved generic-entity reference, plus
Adaptations with either a direct note reference or an `adapted_chapter_ids`
link to a matching Chapter. Existing persisted references remain visible after
rollout.

## Current state

The detail route concurrently calls `getChapterNotesForEntity`,
`getEventsForEntity`, and `getAdaptationsForNovel`. Each reader retrieves a
novel-wide collection and filters nested reference occurrences in memory. The
cost per detail request is therefore `1 + chapters + events + adaptations`
document reads, regardless of how few records refer to the Entity.

## Decision

Store a derived, inverse-reference index in:

```
novels/{novelId}/entityReferences/{referenceId}
```

It is derived data, never an authorization source. Source records remain the
truth: Chapter `notes[].references`, Event `description_references`, and
Adaptation `notes[].references`.

Each index document represents one resolved entity occurrence grouped by its
source note (or by Event description). Its deterministic ID is derived from
the source kind, source document ID, optional note ID, and entity ID. A source
rewrite can therefore replace its entire index set idempotently, and a
backfill can be safely rerun.

| Field | Purpose |
| --- | --- |
| `entity_id` | Canonical typed Entity ID queried by the detail page. |
| `source_type` | `chapter_note`, `event`, or `adaptation_note`. |
| `source_id` | Chapter, Event, or Adaptation document ID. |
| `note_id` | Present for note sources. |
| `volume_id` | Present for Chapter and Adaptation sources. |
| `preview` | Plain-text source preview required by the existing related-record card. |
| `title` / ordering fields | Snapshot metadata needed to build links and stable display without source-document reads. |
| `updated_at` | Source/index freshness and deterministic pagination order. |

The index contains no unresolved references, no raw rich-text JSON, and no
full source record. Multiple occurrences of the same Entity within one note
produce one index document; the UI has always displayed that note once.

## Read path

`EntityDetail` continues to load the target Entity normally. The initial page
does not fetch related records. `EntityCrossReferences` becomes a client-side
expandable panel; on its first expansion it calls a Firebase adapter that
performs the following bounded reads:

1. Query `entityReferences` by `entity_id`, ordered by `updated_at` and
   document ID, with a cursor and a page limit.
2. Render Chapter-note, Event, and direct Adaptation-note entries directly
   from the indexed snapshots.
3. For the Chapter IDs on the loaded page, query Adaptations using
   `adapted_chapter_ids array-contains-any` in chunks of at most 30 (and
   `novel_id == novelId`). Merge and deduplicate them with direct Adaptation
   entries before rendering.

The last step preserves the current indirect Adaptation behaviour while
reading only Adaptations linked to matching Chapters. It is not an N+1 query;
it is bounded by chunks of 30 Chapter IDs. If a later page exposes more
matching Chapters, its linked Adaptations are loaded with that page.

The panel reports loading and retryable Firebase errors with the established
`FormError` / `userErrorMessage` conventions. Empty results keep the section
hidden after the query completes. Guest users retain read-only access.

The normal detail request drops the three novel-wide reads. Its initial cost is
one Entity document; expanding a page costs the matching index documents plus
only linked Adaptations.

## Index maintenance

`libs/firebase/entityReferences.ts` owns pure extraction from persisted
resolved occurrences, deterministic IDs, index document construction,
replacement, deletion, and paginated reading. Presentation components never
write Firestore directly.

Source adapter mutations maintain the index together with their source write:

- `createChapter`, note-changing `updateChapter`, and `deleteChapter` replace
  or delete that Chapter's `chapter_note` documents.
- `createEvent`, description-changing `updateEvent`, and `deleteEvent` replace
  or delete that Event's `event` documents.
- `createAdaptation`, note-changing `updateAdaptation`, and
  `deleteAdaptation` replace or delete that Adaptation's `adaptation_note`
  documents.

Writes that cannot affect persisted references (for example title-only Chapter
edits) do not rewrite the index unless index preview metadata changed. Source
title/ordering edits do refresh the affected source's snapshot metadata so
links and labels do not become stale.

Replacement is transactional when it fits Firestore's transaction limit. A
named conservative maximum rejects an edit that would exceed the safe write
budget, with a user-facing validation error; silently creating a partial index
is prohibited. The calculation includes the source document and existing
counter/marker writes in the same mutation.

Deleting an Entity does not cascade-delete its index documents in this change:
they are derived, harmless without an Entity detail route, and the Admin
backfill can reconcile them. A later cleanup job may prune them.

## Schema, indexes, and security

Add a collection index for the direct subcollection query:

```
entityReferences: entity_id ASC, updated_at DESC, __name__ DESC
```

Add a collection-group index for the linked-Adaptation query:

```
adaptations: novel_id ASC, adapted_chapter_ids CONTAINS
```

The existing recursive Firestore rule already grants public reads and
authenticated writes to this new nested collection. No auth model change is
needed.

## Backfill and rollout

Add `backfill:entity-reference-index`, implemented with Firebase Admin. It
accepts `--project <id>` and exactly one of `--dry-run`, `--apply`, or
`--verify`:

- `dry-run` reports the source documents and index documents that would be
  created, updated, or deleted.
- `apply` reconciles to the absolute source-derived target with idempotent
  bulk writes.
- `verify` reports drift and exits non-zero without writes.

Before creating index records, the migration validates that every relevant
legacy source has persisted reference occurrences. The existing
`backfill:entity-references` migration will be expanded to reconcile Chapters,
Events, and Adaptation notes from their markup before the index backfill runs.
It is executed dry-run/apply first; the index backfill then runs
dry-run/apply/verify.

Production sequence:

1. Deploy source writers and Firestore indexes while the detail reader still
   uses its current compatible path.
2. In an explicitly approved authenticated-write maintenance window, run the
   occurrence backfill and inverse-index dry-run/apply/verify commands.
3. Deploy the bounded lazy reader.
4. Smoke-test direct Chapter/Event/Adaptation links, indirect Adaptation links,
   empty state, pagination, and a guest session.

No production deployment, data write, or maintenance window is authorized by
this implementation work.

## Tests and verification

Adapter/emulator tests prove that index extraction deduplicates repeated
occurrences, source create/update/delete replaces the exact index set, and a
detail reader returns only the requested Entity's entries with stable cursor
navigation. They also cover direct and Chapter-linked Adaptations.

Backfill unit tests use a fake Admin-shaped database to prove dry-run has no
writes, apply converges stale/missing documents, verify detects drift, and
rerunning apply is idempotent. Route/component tests verify the detail page no
longer imports novel-wide related readers and that the panel does not fetch
until expanded.

Per repository policy, implementation will update tests but will not run them.
The handoff will include exact `corepack pnpm lint`, targeted `vitest`, and
build commands for the user to execute.

## Non-goals

- No Firestore full-text search, HTTP API, listener, or second authoritative
  datastore.
- No change to reference syntax, resolution, roles, or guest/authenticated
  permissions.
- No generic cleanup of orphaned index records outside the backfill's
  source-derived reconciliation.
