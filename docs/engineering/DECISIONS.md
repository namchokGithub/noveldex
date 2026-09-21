# Novelndex — Architecture Decisions

## ADR-001: Single repository

**Decision:** Keep a single repository with the repository root as the runtime app.

**Why:** The project is small and all active code now ships together.

---

## ADR-002: Superseded — Go API and PostgreSQL runtime

The former Go API, Redis cache, and PostgreSQL application database were retired after the Firestore migration. PostgreSQL backups are retained only for recovery and auditing.

---

## ADR-003: Superseded — Public rules until authentication

**Decision:** Firestore rules remain public temporarily.

**Why:** Existing data is currently single-user/demo data. Phase 5 will introduce authentication and ownership-aware rules.

**Trade-off:** Do not expose sensitive production data before Phase 5 rules replace the temporary policy.

**Superseded by:** ADR-012 — Phase 5 ships the authenticated-writer/guest split this ADR anticipated.

---

## ADR-004: Fictional story dates remain text

**Decision:** `story_date` remains text and is display-only; it does not determine timeline order.

**Why:** Fictional dates can be non-standard or approximate. Timeline uses explicit story order: a linked event sorts by `volume.number`, then `chapter.sort_order`, then `page_number`, then event `sort_order`. Event `sort_order` breaks ties only within the same volume, chapter, and page; a new event defaults to the next value in that group (`max + 1`) and never renumbers existing events. Events without a linked chapter sort after placed events. This is story order, not chronological calendar order.

**Trade-off:** Users cannot infer a date-based sequence from `story_date`. When a chapter is linked, the UI resolves its current label with `formatChapterLabel`; `chapter_number` on an event remains only as a backward-compatible snapshot.

---

## ADR-005: `Novel → Volume → Chapter`

**Decision:** A novel owns volumes, and a volume owns chapters. Chapter documents live at `novels/{novelId}/volumes/{volumeId}/chapters/{chapterId}`. Each chapter retains `novel_id` and `volume_id` as denormalized query fields.

**Why:** The hierarchy expresses story structure while allowing novel-scoped collection-group queries.

**Trade-offs:** Chapter operations require both parent IDs; moving a chapter between volumes must be an explicit operation and preserve its query fields.

---

## ADR-006: Direct Firestore application architecture

**Decision:** The Next.js app accesses Firestore directly through the Firebase Firestore Lite SDK. Domain modules in `libs/firebase` own reads and writes.

**Why:** The active data model is already document-shaped, removes the unused Go/Redis layer, and supports the current UI with Firestore collection-group indexes.

**Trade-offs:** Firestore indexes must be deployed with `firestore.indexes.json`; full-text search is deferred because Firestore has no native full-text capability. Firestore Lite is REST-only, so it does not supply real-time listeners, offline persistence, or `getCountFromServer`; volume aggregates currently count returned query documents. A client-side scoped quick search (command palette) already covers already-loaded chapters/characters/events and is not a substitute for full-text search.

---

## ADR-008: Chapter notes replace chapter summary

**Decision:** Chapters store an ordered `notes[]` list (timestamped entries) instead of a single free-text `summary`. The legacy `summary` field is still populated — a join of note content — for older callers.

**Why:** Chapter write-ups needed incremental, timestamped entries with per-note `[[Name]]` mention tracking and character auto-linking; a single summary string could not carry that.

**Trade-offs:** Notes written before this change are hydrated lazily for mention/character-link data (`hydrateLegacyNoteRelations` in `libs/firebase/chapters.ts`) the first time they're read.

---

## ADR-009: Chapter reading order is separate from chapter numbering

**Decision:** Every entry in a volume stores `sort_order` for reading order. Regular chapters retain a positive `number` unique within that volume, enforced by `volumes/{volumeId}/chapterNumbers/{number}`; Prologue, Epilogue, Afterword, Side Story, and custom entries use `number: null` with a `kind`. Custom entries require `custom_label`.

**Why:** Story structure needs entries before, between, and after numbered chapters. Reordering those entries must not renumber ordinary chapters or invalidate their volume-scoped `chapterNumbers/{number}` markers. Volume editions commonly restart chapter numbering at 1.

**Trade-offs:** New entries append to their volume and then move through Reorder. Existing chapters require a one-time `backfill:chapter-entry-order` migration before relying on `sort_order` in Firestore queries. Cross-volume views sort by volume number, then entry `sort_order`.

---

## ADR-010: Client-side MiniSearch is the Phase 3 search engine

**Decision:** Build one disposable MiniSearch index per application session from Firestore data. Load the current novel first when the command palette opens from a novel route, then append remaining novels only when global scope is requested. Search scopes filter the same index; Firestore remains the sole source of truth.

**Why:** Firestore has no native full-text search and Phase 3 does not add a server-side search service. The recorded synthetic checkpoints keep engine p95 below 100 ms through 50,000 documents, while chunked builds prevent long initial indexing tasks from blocking the browser.

**Trade-offs:** The index, document map, entity map, and dependency map use client memory and are rebuilt after reload. Incremental loading reduces the first palette-open read and CPU cost, but global search has a deferred loading cost when first requested. Benchmark results require renewed review at later growth checkpoints. IndexedDB and a Web Worker remain deferred until measured cold-start, main-thread, or memory costs justify their added complexity.

---

## ADR-011: Typed entity-reference syntax

**Decision:** Keep `[[Name]]` as the backward-compatible shorthand for a character reference. Use `[[type:Name]]` for an explicit reference, where `type` is one of `character`, `location`, `skill`, `organization`, `item`, or `concept`.

**Reference quick reference:**

- `[[Rimuru]]` — character shorthand
- `[[character:Rimuru]]`
- `[[location:Tempest]]`
- `[[skill:Predator]]`
- `[[organization:Jura Tempest Federation]]`
- `[[item:Anti-Magic Mask]]`
- `[[concept:Magicules]]`

**Why:** Different entity types can share a name. Explicit types make references unambiguous while preserving existing chapter notes that use the character-only shorthand.

**Resolution:** Names and aliases resolve only within the owning novel and requested type. Untyped `[[Name]]` resolves as `character` only; it never infers another entity type. Unknown, malformed, or ambiguous tokens remain searchable text and are not silently linked.

**Visual treatment:** Resolved internal references use a type-specific text and underline color: character `#0369A1`, location `#047857`, skill `#7C3AED`, organization `#B45309`, item `#BE123C`, and concept `#C49F0E`. Manual external links retain their separate teal italic treatment.

---

## ADR-012: Authenticated writer + guest authentication (Firebase Auth)

**Decision:** Firebase Auth uses email/password with no self-registration UI. `isAdmin = user !== null` intentionally means any signed-in Firebase Auth user can write. Firestore keeps `read: if true`; `write` becomes `if request.auth != null`.

**Why:** The app needs an authenticated writer and a guest who only views. Firebase Auth's built-in session handling covers this without reintroducing the JWT/refresh-token machinery the Firestore migration removed.

**Trade-offs:** UI hiding of mutation controls is a UX convenience only; the Firestore rule is the actual enforcement boundary. This deliberately does not distinguish among authenticated users; add roles, an allowlist, or custom claims only through a new ADR.

---

## ADR-013: Denormalized Novel and Volume counters

**Decision:** Store maintained summary counters on each Novel and Volume document so readers can use bounded Volume pagination without scanning all descendant Chapters. The source-of-truth ownership is:

| Owner document | Stored fields | Source of truth |
| --- | --- | --- |
| `novels/{novelId}` | `volume_count`, `chapter_count`, `read_count` | Descendant Volume documents and regular Chapter documents in the Novel. |
| `novels/{novelId}/volumes/{volumeId}` | `chapter_count`, `read_count`, `adaptation_count`, `event_count` | Regular Chapter documents, all direct Adaptation documents, and Events linked to an existing Chapter beneath that Volume. |
| `novels/{novelId}/volumes/{volumeId}/chapters/{chapterId}` | `event_count` | Events linked to that Chapter. |

A Chapter counts only when `kind === "chapter"`. A regular unread Chapter contributes `{ chapter_count: 1, read_count: 0 }`; a regular read Chapter contributes `{ chapter_count: 1, read_count: 1 }`. Every special entry — including `prologue`, `epilogue`, `interlude`, and `other` — contributes zero to both counters regardless of `read_at`. Therefore, changing a special entry's Date Read never changes `read_count`; changing a regular Chapter from unread to read adds one, and changing its read date while it remains read adds zero.

Stored counters are derived data and never the source of truth. Chapter and Volume mutations maintain them alongside source writes; a Firebase Admin backfill recomputes absolute totals from source documents and is used to reconcile existing data before readers switch to counters.

Adaptation counters change only when an Adaptation is created or deleted; editing one does not alter its volume ownership. Event counters change only when an Event is created/deleted with a linked Chapter, or when its chapter link is added, removed, or moved. Updating event content, date, page, or order does not alter any counter. The event/adaptation source mutation and all affected counters are written in one Firestore transaction. Counter decrements clamp to zero so stale legacy values cannot become negative. The reconciliation utility writes `counter_schema_version: 2` and recomputes `adaptation_count` and `event_count` even though no reader displays them yet.

**Rollout:** (1) deploy counter-writing mutations while readers retain current queries, (2) block authenticated client writes for maintenance, (3) dry-run/apply/verify the Admin backfill, (4) deploy counter readers and cursor UI, (5) restore writes, then (6) verify after a create/read/unread/delete Chapter smoke sequence.

**Trade-offs:** This adds write maintenance and a temporary production write pause, but keeps Firebase Lite and avoids unavailable aggregation APIs. Counter drift is recoverable by rerunning the source-of-truth backfill.

The volume detail page still does not display these counters: it avoids an events query entirely and fetches at most one adaptation for its latest-item preview. The counters are maintained ahead of the future aggregate UI so enabling that UI will not require a source-collection scan.
