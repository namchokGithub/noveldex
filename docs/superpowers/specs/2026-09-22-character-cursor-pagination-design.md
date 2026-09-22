# Character cursor pagination and counters

## Goal

Make `/novels/:id/characters` a bounded Firestore read while retaining its
current list UI: alphabetical order, total-result display, page controls, and
the per-character chapter-appearance badge. A normal list request must not
read every Character or every Chapter in the Novel.

## Current state

`getCharacters` calls `getAllCharacters` and `chapterCountsByNovel`, then
slices the two in-memory result sets. Consequently, an ostensibly paginated
page reads every Character document and every descendant Chapter document.
`docs/firebase-recheck.md` tracks this as H6.

Firestore Lite does not provide an approved aggregate-count API in this
runtime. Counting on demand would retain an unbounded collection read; a
per-visible-character count query would introduce N+1 reads. The list needs
stored, derived counters.

## Decision

Use opaque, bidirectional Firestore cursors ordered by `name`, then document
ID, and maintain two additive derived counters:

| Owner                                       | New field         | Meaning                                                                                           |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `novels/{novelId}`                          | `character_count` | Number of direct Character documents in that Novel.                                               |
| `novels/{novelId}/characters/{characterId}` | `chapter_count`   | Number of distinct descendant Chapters whose persisted`character_ids` contains that Character ID. |

The source of truth remains Character documents and `Chapter.character_ids`.
Counters are cacheable derived data, never references or authorization data.
They are maintained transactionally with their source mutation and reconciled
with an idempotent Admin backfill before cursor readers depend on them.

The existing `Character.chapter_count` response field is unchanged. The
listing reader returns its stored value; the detail reader continues to
hydrate `chapters[]` and uses its retrieved Chapter count as the authoritative
detail value until a future change deliberately chooses otherwise.

## Cursor contract

`CharacterCursor` is `{ name: string; id: string }`. It is JSON encoded and
URL encoded in `after` or `before`, following the Volume cursor pattern.

- Forward: `orderBy("name", "asc"), orderBy(documentId(), "asc"), startAfter(cursor.name, cursor.id), limit(perPage)`.
- Backward: reverse both orderings, `startAfter(cursor.name, cursor.id)`,
  `limit(perPage)`, then reverse returned documents in memory for display.
- First page has no cursor. Invalid, incomplete, or path-containing cursor IDs
  are ignored and normalize the request to page 1.
- A navigation request carries exactly one of `after` or `before`; changing
  page size resets both and returns to page 1.
- `previousCursor` is the first visible item only when page > 1;
  `nextCursor` is the last visible item only when `page < total_pages`.

`total_items` comes from `Novel.character_count`, and `total_pages` is
derived from it. This preserves the current UI text without a count query.
Ordering uses `documentId()` as a tie-breaker so duplicate names never skip or
repeat documents. A direct subcollection query requires no composite index
beyond Firestore's automatic single-field indexes; no index or rules change is
needed.

## Write maintenance

### Character lifecycle

- `createCharacter` creates the document with `chapter_count: 0` and
  increments its parent Novel's `character_count` in the same transaction.
- `deleteCharacter` decrements `character_count` with a zero clamp and deletes
  the character in the same transaction. Existing chapter references retain
  the current product behaviour (they are not cascaded); a later recreation
  with another document ID does not inherit them.

### Chapter lifecycle

`Chapter.character_ids` is currently derived from resolved note references.
The owning set—not mention frequency—is the count basis. For each source
change, calculate `added = next IDs - previous IDs` and
`removed = previous IDs - next IDs`, deduplicated.

- `createChapter`: increment every ID in its initial `character_ids`.
- `updateChapter` with `notes`: read the Chapter in the transaction that
  writes new notes, compare sets, and apply `+1/-1` to affected existing
  Character documents. A Chapter edit that changes only title, description,
  reading status, numbering, or order does not affect character counters.
- `deleteChapter`: decrement every ID in its persisted `character_ids` before
  deleting the Chapter.
- Tag linking and reordering do not affect character counters.

Counter updates skip character references whose documents no longer exist,
matching the current tolerant hydration behavior. Decrements clamp to zero to
make stale legacy counter values recoverable. The mutation must not create a
missing Character document.

Because Firestore transactions cap writes, a validation limit will reject a
Chapter note update that resolves to more than the transaction-safe number of
distinct affected character documents. The exact limit accounts for the
Chapter, chapter-number marker, Novel/Volume counter updates, and character
updates; it will be a named constant with a user-facing validation error.

## Reconciliation and rollout

Extend `backfill:denormalized-counters` (or add a focused compatible mode) to
derive `novels.character_count` from direct Character documents and each
Character's `chapter_count` from its Novel's descendant Chapter
`character_ids`. It supports existing `--dry-run`, `--apply`, and `--verify`
modes, writes absolute values with merge semantics, and is idempotent when
source data is unchanged.

Roll out in this order:

1. Deploy counter-writing mutations while the list reader still uses its old
   behavior.
2. During an approved authenticated-write maintenance window, run dry-run,
   apply, and verify against the selected Firebase project.
3. Deploy the cursor reader and UI after verification is clean.
4. Confirm create, note-link, note-unlink, and delete Chapter sequences update
   the list badges; confirm next/previous navigation around duplicate names.

No production data write, deployment, or maintenance window is authorized by
this code change. Those remain explicit operational actions.

## Components and boundaries

- `libs/firebase/characters.ts` owns cursor serialization/validation, the
  bounded page reader, and Character lifecycle counter writes.
- `libs/firebase/chapters.ts` owns set-delta calculation from its source data
  and calls a focused character-counter transaction helper.
- `libs/firebase/counters.ts` owns generic transaction-safe increment/clamp
  helpers so counter mechanics do not leak into UI components.
- The characters route parses opaque search parameters and delegates to the
  adapter. `CharacterList` only constructs URLs and renders navigation; it
  makes no Firestore calls.
- `app/types.ts` and `libs/api/index.ts` expose only the page/cursor contracts
  needed by the route.

## Tests and verification

Tests will use the Firestore emulator and prove observable behavior:

- cursor forward/backward traversal with duplicate names has no gaps or
  duplicates;
- malformed cursors fall back safely to the first page;
- changing page size removes stale cursors;
- list totals come from `character_count`, not a full Character scan;
- Character create/delete updates `Novel.character_count`;
- Chapter create, note-reference replacement, and delete apply exact distinct
  Character counter deltas and do not create missing Character documents;
- reconciliation calculates and verifies the two new fields from source data.

Per repository instructions, implementation will add/update the relevant test
files but will hand off exact lint/test/build commands rather than run them.

## Non-goals

- No full-text Character search or new Firestore query service.
- No change to rich-note reference resolution, aliases, Character roles, or
  guest/authenticated permissions.
- No cascade deletion of Chapter references when a Character is deleted.
- No change to the detail-page appearance list beyond continued compatibility
  with the stored list counter.
