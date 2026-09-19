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

**Decision:** Build one disposable MiniSearch index per application session from Firestore data. Search scopes filter the same global index; Firestore remains the sole source of truth.

**Why:** Firestore has no native full-text search and Phase 3 does not add a server-side search service. The recorded synthetic checkpoints keep engine p95 below 100 ms through 50,000 documents, while chunked builds prevent long initial indexing tasks from blocking the browser.

**Trade-offs:** The index, document map, entity map, and dependency map use client memory and are rebuilt after reload. Benchmark results require renewed review at later growth checkpoints. IndexedDB and a Web Worker remain deferred until measured cold-start, main-thread, or memory costs justify their added complexity.

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
