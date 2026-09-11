# Novelndex — Phase 3: Timeline + Search Plan

> Status: Revised plan — Entity References, scoped search, and growth checkpoints
> Scope: Phase 3
> Primary stack: Next.js 16 / React 19 / Cloud Firestore
> Source of truth: Firestore
> Search: One derived client-side MiniSearch index per app/provider
> SQL Connect / Cloud Functions / external search: Out of scope

---

## 1. Goal

Phase 3 completes two related capabilities:

1. Preserve shipped timeline CRUD, chapter/character links, character filtering, and deterministic story order; audit labels/navigation and include events in search.
2. Search story metadata and plain-text notes using a generic Entity Reference System, explicit hierarchical scopes, and measured performance as the dataset grows.

This document specifies planned work; the generic entity model and search provider are not claims about already shipped functionality.

## 2. Growth and Performance Checkpoints

Note count is expected to grow. The former estimate of approximately 1,150 notes is neither a capacity limit nor an architectural justification. Measure the complete searchable corpus, including metadata, individual notes, entities, events, aliases, and reference fan-out.

Benchmark at the real baseline, then representative fixtures of **5,000, 10,000, 25,000, and 50,000 search documents**, and whenever the measured corpus doubles. These are checkpoints, not supported-capacity promises or automatic backend migration triggers. Include multiple novels, realistic note-length distributions, Thai/English text, common terms, repeated references, and mutation-heavy workloads.

Record browser, device, dataset seed, library/tokenizer versions, cold/warm state, and at least 30 repetitions for latency measurements. Include a representative lower-powered supported device.

| Metric | What to record | Initial review threshold / response |
| --- | --- | --- |
| Document count | Total and per type, source notes, tokens, reference/alias fan-out | Run the checkpoint suite at each growth milestone |
| Index build time | Load, normalize, build, total time-to-ready separately; cold and warm | Build over 1 s or indexing tasks over 50 ms: introduce/tune chunked async indexing |
| Search latency | p50/p95 for exact, prefix, fuzzy, each scope; engine and input-to-render separately | Target engine p95 ≤100 ms and input-to-render p95 ≤300 ms including debounce; investigate breaches |
| Index memory | Heap delta for index, document map, lookup/dependency maps; peak during rebuild; serialized bytes separately | Over 50 MiB retained search memory on the baseline device: review duplicate data and field selection |
| Firestore/search dataset size | Firestore documents read, estimated fetched bytes, normalized bytes, serialized index bytes, largest chapter with embedded notes | Over 10 MiB fetched search data or cold ready time over 3 s on the recorded network: review payload/loading and cache value |
| Mutation maintenance | Update latency, discarded entries, memory/latency after repeated replacements/deletes | Sustained degradation: benchmark vacuum configuration and recovery rebuild |

These numbers are **proposed engineering budgets, not measured results**. Validate and record the agreed budgets before shipping. Serialized index size is not a substitute for runtime memory. If heap measurement is unavailable, report it as unavailable and collect a profiling trace on a supported profiling browser.

A displayed result limit does not bound MiniSearch's internal candidate work. Benchmark broad queries and small scopes over the full global corpus. Track growth of embedded `notes[]` and review chapter storage separately if it approaches Firestore document constraints; introducing a search index does not solve source-document growth.

## 3. Architecture Decision

Firestore remains authoritative for records, stable IDs, aliases, saved references, and tags. MiniSearch and all client lookup maps are disposable projections.

```text
Firestore: novels / volumes / chapters with notes / characters / entities / events / tags
    ↓ lightweight search loader + normalization
SearchIndexProvider (one per app session)
    ├── one global MiniSearch index
    ├── normalized document map + entity/dependency lookup maps
    └── search(query, SearchScope) → ranked, limited results → existing UI
```

Keep existing `novels/{novelId}/characters/{characterId}` records and IDs. Add `novels/{novelId}/entities/{entityId}` for the other initial types, with a shared domain adapter exposing all six types. This avoids duplicating authoritative character names into a second registry. Existing `character_roles` and character-specific UI remain supported.

No index per novel, volume, or chapter; scope changes reuse the same index. No Firestore reads on each keystroke. No SQL Connect, Cloud Functions sync, HTTP search endpoint, or external search service in Phase 3.

## 4. Generic Entity Reference System

### Entity contract

```ts
type EntityType =
  | "character"
  | "location"
  | "skill"
  | "organization"
  | "item"
  | "concept";

type EntityId = string; // Immutable, novel/type-qualified key; never derived from name.

type Entity = {
  id: EntityId;
  novelId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description?: string;
};

type EntityReference = {
  entityId: EntityId;
  entityType: EntityType;
  label: string; // Original authored display text; not identity.
};
```

Use a collision-safe key constructed from immutable `(novelId, entityType, sourceRecordId)` components, for example a serialized tuple. Existing character IDs map deterministically to this key; source IDs and character routes remain intact. Entity type is immutable in Phase 3.

### Syntax and resolution

| Authored text | Interpretation |
| --- | --- |
| `[[Rimuru Tempest]]` | Backward-compatible character reference |
| `[[character:Rimuru Tempest]]` | Explicit character reference |
| `[[location:Tempest]]` | Location reference |
| `[[skill:Predator]]` | Skill reference |
| `[[organization:Jura Tempest Federation]]` | Organization reference |
| `[[item:Dragon Sword]]` | Item reference |
| `[[concept:Magicules]]` | Concept reference |
| `Rimuru fought Hinata.` | Searchable plain text; no inferred relationship |

Resolve within the owning novel and requested type using canonical names and aliases. Untyped syntax defaults only to `character`; it must not infer another type from a matching name. Trim and Unicode-normalize labels; apply the same documented case policy to canonical names and aliases while preserving Thai marks and original display text.

A unique match yields a stable ID saved with the source content in Firestore. Unknown, malformed, or ambiguous references remain searchable text and receive an unresolved/ambiguous status in the editor; never silently choose the first match or create an entity. Validate name/alias collisions within `(novelId, type)` on writes, but still handle existing ambiguous records. Alias matching applies to all six types from the initial release.

Persist occurrence bindings alongside plain content (for example token spans in the saved content revision mapped to `EntityReference`). This preserves the exact target through renames and unrelated edits. Reconcile unchanged occurrences against prior bindings; explicitly changed or newly inserted tokens require resolution. Names/aliases are lookup inputs, not a reason to rebind an existing saved reference to another ID.

Entity renames refresh projected names on dependent search documents without changing reference IDs or rewriting authored prose. Deletion leaves an explicit missing-target binding and searchable original text until repaired; exclude missing targets from active relationship filters. Recreating the same name must not retarget old bindings.

### Compatibility and persistence

- Add authoritative generic references to notes and applicable chapter/event relationships; save content and bindings together through domain mutations.
- Read new generic references when present, including an explicitly empty list. Otherwise adapt legacy `character_ids` and `mentioned_character_names`; IDs take precedence over name resolution. Preserve old names as text if no unique target exists.
- During legacy hydration, retain valid structured IDs even when a token cannot be bound uniquely. Do not lose manually linked relationships or guess occurrence-to-ID mappings.
- Keep legacy character relationship fields as a compatibility projection for shipped character filters/counts and event UI until consumers migrate. Derive them from the character subset of generic references, not from a separate parser.
- Make backfill idempotent and preserve note/source IDs. Add serialization and round-trip checks so generic references survive reads, edits, and saves. Search initialization must not write a migration to Firestore.
- Provide minimal create/edit/select support for the five new entity types, canonical names, and aliases. A shared entity detail view is sufficient; six bespoke management systems are unnecessary.

Tags remain independent classification data, not entity references.

## 5. Search Document Model

```ts
type SearchDocumentType =
  | "novel" | "volume" | "chapter" | "note" | "entity" | "event";

type SearchDocument = {
  id: string; // Collision-safe composite source identity.
  type: SearchDocumentType;
  novelId: string;
  volumeId?: string;
  chapterId?: string;
  noteId?: string;
  eventId?: string;
  entityId?: EntityId;
  entityType?: EntityType;

  name?: string;
  title?: string;
  author?: string;
  content?: string;
  description?: string;

  referenceIds: EntityId[];
  referenceNames: string[];
  referenceTypes: EntityType[];
  aliases: string[];
  tagIds: string[];
  tags: string[];
  route: string;
};
```

Replace `characterNames` / `characterIds` in the search contract with `referenceIds`, `referenceNames`, `referenceTypes`, and `aliases`. Character records become `type: "entity", entityType: "character"`. The generic reference arrays are deduplicated projections, **not parallel arrays**; resolve ID-to-type/name relationships through the entity map. IDs and types are structured metadata, not fuzzy full-text fields.

For entity documents, `name` and `aliases` describe that entity. For referencing documents, `referenceNames` contains current canonical names and `aliases` contains aliases of active referenced entities. Preserve original mention labels in searchable content even after a rename or deletion. Keep tags in `tagIds` / `tags` only.

Normalize arrays into text via an explicit field extractor or index adapter; do not depend on implicit array stringification. Keep full excerpt/routing data in a document map keyed by search ID, avoiding duplicate copies in MiniSearch `storeFields`.

## 6. Searchable Content and Stable Identity

| Source | Indexed content |
| --- | --- |
| Novel | Title, author, description |
| Volume | Display label/number, title, description |
| Chapter | `formatChapterLabel`, title, description, explicit references, tags |
| Note | Plain content, resolved reference names/aliases, applicable tags |
| Entity (all six types) | Canonical name, aliases, description/notes |
| Timeline event | Title, description/content, current linked chapter label, references/aliases |

Each embedded note is an individual search document. Never use array position as identity. Use collision-safe composites containing the full ancestry, conceptually `note:<novelId>:<volumeId>:<chapterId>:<noteId>`; use a tuple encoding or escaped components. This also prevents collisions among `legacy-summary` notes in different chapters. Preserve existing note IDs and timestamps.

Do not duplicate note content into the chapter's legacy `summary` search field. Hydrate all relationship fields before normalizing. Where notes lack independent tags, inherit the chapter's tags consistently and refresh notes on chapter-tag changes.

Tags produce matches on linked chapters/notes, not standalone tag results without a detail route.

## 7. First-class SearchScope

```ts
type SearchScope =
  | { kind: "global" }
  | { kind: "novel"; novelId: string }
  | { kind: "volume"; novelId: string; volumeId: string }
  | { kind: "chapter"; novelId: string; volumeId: string; chapterId: string };
```

Hierarchy: **global → novel → volume → chapter**. Require every parent ID to prevent cross-novel collisions.

| Current page | Default | Widening options |
| --- | --- | --- |
| Home | Global | — |
| Novel | Current Novel | Global |
| Volume | Current Volume | Current Novel → Global |
| Chapter | Current Chapter | Current Volume → Current Novel → Global |

Resolve the default from the route when opening search. Store query and scope independently; widening reruns the same query without clearing input or rebuilding the index. Preserve a manual scope choice while the dialog remains open; opening from a new page uses that page's default.

Expose `search(query, scope, options)` as the provider contract. Compile scope into a predicate passed to **every MiniSearch query stage** via its `filter` option, looking up metadata by result ID in the provider map. Apply scope before ranking truncation and before deciding whether fallback stages are needed. Never take global top-N and then filter it in the UI.

Membership follows document placement:

- Global includes the complete loaded authorized corpus; novel scope requires matching `novelId`.
- Volume scope additionally requires matching `volumeId`; chapter scope also requires matching `chapterId`.
- Notes inherit chapter ancestry. Placed events derive current ancestry from their linked chapter; volume-only events belong to that volume but not a chapter.
- Novel-level entities and unplaced events appear in global/novel scope. A reference inside a chapter makes the **referencing content** match there; it does not place the standalone entity in that chapter.
- Chapter scope includes the chapter and its notes/placed events; ancestor novel/volume documents do not become chapter results.

MiniSearch's predicate ensures correct scope membership, not a separate partitioned index or guaranteed reduction in term traversal. Include this cost in benchmarks. Loading readiness must reflect the complete selected scope; never label partially loaded global results as complete.

## 8. Ranking and Query Strategy

Ranking order is explicit:

1. **Exact > prefix > fuzzy** match tier.
2. Within a tier: **entity/name/title > reference > aliases > tags > content**.
3. Within the same field tier: relevance score, then stable document ID for deterministic ties.

Treat `name`/`title` as the highest field tier (including entity names), `referenceNames` next, then `aliases`, `tags`, and `content`/`description`. Author matches share the name tier. A document's type alone does not promote an entity-description match above a title match.

Implement staged queries with scope and the same tokenizer/normalization:

- First search exact tokens with prefix/fuzzy disabled and all query terms required. Exact here means normalized token equality; test full canonical-name/title equality as an additional within-tier preference.
- If fewer than the result limit survive scope, run prefix fallback. Enable expansion only on the final incomplete term, initially at least 2 normalized characters; other terms must match exactly. Do not expand a completed trailing-space term. Validate a Thai-specific minimum against segmented examples.
- Only if still under the limit, run fuzzy fallback for longer terms (initially ≥5 normalized characters), with a small distance ratio such as `0.2` and **`maxFuzzy: 1`**. Keep prefix disabled in this stage; allow increasing the bound to at most 2 only with relevance/latency evidence. Short terms remain exact.
- Deduplicate by document ID, retaining the strongest tier. Rank before applying the final limit (initially 30 results). Empty input shows the command palette's default actions without a wildcard corpus search.

Use field boosts as an initial relevance configuration, for example name/title/author `10`, references `6`, aliases `4`, tags `2`, content/description `1`. Boosts alone do not guarantee the required hierarchy: retain explicit match-tier and strongest matching field-tier metadata in the ranking adapter, then use MiniSearch score within those buckets. Do not stop after an arbitrary global candidate slice.

Debounce input initially by 150 ms, suppress intermediate IME composition queries, and ignore stale query/scope responses. Preserve query text through scope changes. Tune budgets and minimum term lengths using representative Thai/English queries, not library defaults alone.

## 9. MiniSearch Configuration and Language Validation

Index text fields: `name`, `title`, `author`, `referenceNames`, `aliases`, `tags`, `content`, `description`. Start with `storeFields: []` and resolve result metadata through the provider document map; add a stored field only when measured or required by the adapter.

Use explicit tokenizer and `processTerm` functions shared by ingestion and queries. Validate Thai word segmentation (for example an `Intl.Segmenter` candidate with a supported-browser fallback), mixed Thai/English names, punctuation, Unicode normalization, combining marks, aliases, incomplete words, and typos. Do not strip Thai marks or assume whitespace tokenization is sufficient. If a prefix/fuzzy fixture fails, adjust tokenization or expansion policy before shipping.

Implementation API references: MiniSearch provides [query predicates, boosts, conditional prefix/fuzzy, and maxFuzzy](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html) and [field extraction, incremental mutations, async indexing, and vacuuming](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html). Pin the chosen version and verify these contracts during implementation. Thresholds and ranking policy above are project decisions, not library guarantees.

## 10. Index Ownership, Loading, and Mutations

`SearchIndexProvider`, mounted once beneath the application layout, owns one global index for the current app/session dataset. Firestore domain modules remain unaware of MiniSearch. The command palette calls the provider. Guard initialization against duplicate concurrent builds; normal rerenders, route changes, and scope changes do not rebuild it.

Load a purpose-built search dataset: novels; volumes without list-page aggregate counts; chapters with embedded notes, references, and tags; all entity types; events; and tag definitions. Reuse valid page data, but do not use `getVolumes` if it performs unnecessary aggregate reads. Deduplicate source loads and bound fetch concurrency. Expose loading/error/retry and selected-scope completeness states.

Build once, using chunked/async indexing as corpus growth or long-task measurements require. Async readiness and mutations must be coordinated: queue/version mutations during initial loading so a stale snapshot cannot overwrite a newly saved record.

After successful Firestore writes, dispatch typed source-change events to the provider:

- Create → normalize and `add`.
- Update → normalize and `replace`; add if not yet present.
- Delete → `discard` the search document and remove its map entry; cascade removal for deleted descendants.
- Chapter-note edits → diff by stable note ID, updating only affected notes and chapter relationship/tag projections.
- Entity rename/alias update → refresh entity and referencing documents using a reverse dependency map keyed by entity ID.
- Entity deletion → refresh dependencies, retaining missing-target text/bindings as described above.
- Tag rename/delete or parent metadata/move → refresh affected names, inherited tags, ancestry, and routes.

Keep index and document/dependency maps consistent in a serialized update queue. If indexing fails after a successful Firestore write, mark the projection stale and recover; never roll back authoritative data merely to satisfy the index. A full rebuild is the recovery path, not routine mutation handling.

Monitor discarded entries and retained memory during frequent mutations. Benchmark automatic vacuum behavior first; tune/schedule maintenance when dirty-entry growth warrants it. Avoid vacuum after every keystroke or every save. Verify discarded documents never reappear during maintenance.

Cross-tab live synchronization is deferred; reopening reloads Firestore. Clear the dataset/index on user/session changes if applicable so data cannot leak between sessions.

## 11. Benchmark-gated Cache and Worker

Neither IndexedDB nor a Web Worker is a default Phase 3 dependency.

- Consider **IndexedDB** only when cold loading/build measurements justify caching. Validate schema/tokenizer versions, user/dataset identity, freshness, deletion handling, and Firestore refresh before claiming completeness.
- Consider a **Web Worker** only when query or indexing long tasks remain outside the agreed budget after chunking, field reduction, and query tuning. Measure message-copy/transfer cost and additional memory. Move the sole index into the worker; do not retain a duplicate main-thread index.

If a cache is introduced, metadata should include schema/tokenizer version, dataset/session identity, build timestamp, and a freshness strategy. A cache remains derived and discardable; it is never authoritative and never a separate cache/index per scope. Record benchmark evidence and the chosen tradeoff before adding either mechanism.

## 12. Search UI and Routing

Extend the existing command palette and retain **Ctrl + Shift + K**. Show current scope and widening controls beside the query. Display result type/entity subtype, title, excerpt, volume/chapter context, and matched reference/tag where useful.

Preserve ranking order in presentation; type labels must not let a lower-tier fuzzy entity group jump above exact note results. Maintain keyboard navigation, Enter/click activation, Escape, focus restoration, loading/error states, and empty/no-result states.

Route results to authoritative UI:

- Novel → `/novels/:novelId`
- Volume → `/novels/:novelId/volumes/:volumeId`
- Chapter → `/novels/:novelId/volumes/:volumeId/chapters/:chapterId`
- Note → chapter route + `?note=:noteId`
- Character entity → existing character detail route
- Other entity types → shared entity detail view using stable entity ID
- Event → existing timeline route with selected event

The chapter page reads `note`, finds its pagination page, renders `id="note-:noteId"`, and scrolls after that page mounts. A hash alone is insufficient. Every indexed entity must have a working destination; settle the shared entity route using existing conventions during implementation.

## 13. Timeline Requirements

Preserve title, description/content, novel, optional volume/chapter, page/location, character relationships, ordering, and timestamps. Add generic references through the shared adapter while maintaining existing character-specific filters/navigation via the character subset.

`story_date` is display text, not a sortable calendar value. Preserve deterministic story order:

```text
volume.number → chapter.sort_order → page_number → event.sort_order
```

Events without a linked chapter sort after placed events; use a stable ID tie-breaker. Resolve current chapter metadata and use `formatChapterLabel`; `chapter_number` remains a backward-compatible snapshot. Preserve grouping, CRUD, linked-chapter navigation, and linked-character navigation. Include events in global and placement-appropriate scoped search.

## 14. Implementation Slices

### Phase 3A — Timeline audit

- [ ] Verify shipped event shape, current chapter labels, story-order comparator, and navigation.
- [ ] Preserve character filtering/CRUD with focused regression coverage.

### Phase 3B — Entity references and compatibility

- [ ] Add shared entity types/adapter, stable qualified IDs, names, aliases, and minimal generic entity UI.
- [ ] Implement typed/untyped parsing, scoped resolution, occurrence bindings, and ambiguity/missing-target behavior.
- [ ] Persist generic references and retain legacy character compatibility projections.
- [ ] Add idempotent migration/hydration and round-trip verification; preserve all source/note IDs.

### Phase 3C — Normalization and provider

- [ ] Add generic SearchDocument and normalize all source types, references, aliases, and separate tags.
- [ ] Implement lightweight loaders, document/dependency maps, and completeness states.
- [ ] Mount one provider/index and coordinate one-time build with queued mutations.

### Phase 3D — Scoped retrieval and ranking

- [ ] Add first-class SearchScope and route-derived defaults with query-preserving widening.
- [ ] Apply its predicate at every retrieval stage before fallback decisions and limits.
- [ ] Implement exact/prefix/fuzzy tiers, field priority/boosts, deduplication, and final result limit.
- [ ] Add debounce, IME handling, conditional expansion, bounded maxFuzzy, and Thai/English fixtures.

### Phase 3E — Search UX

- [ ] Integrate the existing command palette with context, scope, accessible navigation, and states.
- [ ] Support note pagination anchors, entity routes, and selected event navigation.

### Phase 3F — Consistency and growth validation

- [ ] Incrementally add/replace/discard after successful mutations and refresh dependencies.
- [ ] Verify delete cascades, renames, stale-build protection, and rebuild recovery.
- [ ] Record count/build/latency/memory/Firestore-dataset benchmarks at growth checkpoints.
- [ ] Introduce chunked async indexing as needed; benchmark discard/vacuum maintenance.
- [ ] Record whether IndexedDB or a worker is justified; implement only with evidence.

## 15. Acceptance Criteria

- [ ] Plain note text is searchable without markup.
- [ ] Untyped `[[Rimuru Tempest]]` still resolves as character; all six typed forms and aliases resolve to stable IDs.
- [ ] Equal names across types/novels do not cross-resolve; ambiguity never silently picks a target.
- [ ] Renames and unrelated text edits preserve bindings; deleted/recreated names do not retarget saved references.
- [ ] Legacy structured character relationships survive hydration/backfill and remain available to current filters/counts.
- [ ] Generic references survive Firestore save/load; an explicitly empty reference list does not resurrect legacy links.
- [ ] SearchDocument uses referenceIds/referenceNames/referenceTypes/aliases with tags separate.
- [ ] Search includes novels, volumes, chapters, notes, all six entity types, and timeline events.
- [ ] One index is reused across scopes, keystrokes, and route changes; normal saves use incremental updates.
- [ ] Home/Novel/Volume/Chapter defaults match their scope; widening preserves query text.
- [ ] Many higher-scoring out-of-scope hits cannot hide a valid scoped result or incorrectly suppress fuzzy fallback.
- [ ] Placement rules for entities, volume-only events, and unplaced events match Section 7.
- [ ] Exact beats prefix beats fuzzy; within each tier, field priority follows Section 8, even with adverse term-frequency scores.
- [ ] Conditional prefix/fuzzy, maxFuzzy bounds, debounce, result limits, and Thai/English tokenizer fixtures pass.
- [ ] Note IDs cannot collide across chapters/novels, including legacy summaries; later-page note links work.
- [ ] Current chapter labels use `formatChapterLabel`; tags return linked content, not unroutable tag documents.
- [ ] Updates/deletes/renames refresh dependent results; mutation-during-build and recovery tests pass.
- [ ] No query-per-keystroke Firestore reads; no duplicated per-scope indexes or unnecessary storeFields.
- [ ] Benchmark report records actual measurements and budget decisions, including broad-query and mutation workloads.
- [ ] Cache/worker remain deferred unless benchmarks justify them; chunking and vacuum decisions are documented.
- [ ] Command palette accessibility and shipped timeline CRUD/filter/order/navigation remain intact.
- [ ] Firestore is the sole source of truth; the entire search projection can be rebuilt from it.

## 16. Out of Scope and Re-evaluation

SQL Connect, PostgreSQL search projections, Cloud Functions/search sync, external search services (including Algolia/Typesense/Elasticsearch), server-side search APIs, vector/semantic search, AI search summaries, shared/public cross-user indexes, and complex search analytics remain out of scope.

Measured budget breaches after client-side tuning, or new shared/public/server-side search requirements, can justify a separate architecture proposal. Document count alone does not authorize a backend switch, and a future proposal does not expand Phase 3 scope.

Phase 3 delivers **Firestore + generic stable entity references + one derived MiniSearch index + first-class hierarchical scopes**, with incremental maintenance and explicit growth checkpoints.
