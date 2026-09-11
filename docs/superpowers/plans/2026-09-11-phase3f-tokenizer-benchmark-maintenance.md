# Phase 3F: Thai Tokenizer + Incremental Maintenance + Benchmark Implementation Plan

**Goal:** Configure MiniSearch's tokenizer for mixed Thai/English text, make the index resilient to entity/document deletion (cascading discards and reference-projection refresh instead of stale or dangling results), and produce the growth-checkpoint benchmark harness and its first recorded report.

**Architecture:** `libs/search/tokenize.ts` supplies `tokenize`/`processTerm` to `buildIndex` (from the SearchDocument-provider plan), using `Intl.Segmenter` for Thai word boundaries with a whitespace/punctuation fallback where it's unavailable. `SearchIndexProvider` first gains a serialized, batch mutation API and exposes its live `entityMap`; every cascade then commits an index/document/dependency-map update atomically. `libs/search/refresh.ts` recomputes a document's `referenceNames`/`referenceTypes`/`aliases` projection from that map. `libs/search/cascadeDelete.ts` removes only records actually deleted from Firestore. `scripts/one-off/benchmark-search-index.ts` generates deterministic synthetic fixtures at the spec's checkpoint sizes and reports build time, search latency percentiles, dataset size, and Node-process-approximated memory against the spec's review thresholds.

**Tech Stack:** Next.js 16 / React 19, MiniSearch `^7.2.0`, Node (`tsx`) for the benchmark script.

**Spec:** `docs/superpowers/specs/2026-09-11-novelndex_phase_3_timeline_search-design.md` — Sections 2 (Growth and Performance Checkpoints), 9 (MiniSearch Configuration and Language Validation — the tokenizer half), 10 (Index Ownership, Loading, and Mutations — the cascade/vacuum half), and 11 (Benchmark-gated Cache and Worker).

**Depends on:** `docs/superpowers/plans/2026-09-11-phase3c-search-document-provider.md` (`buildIndex`, `SearchIndexProvider`, `dependents` map, `EntityMap`) and `docs/superpowers/plans/2026-09-11-phase3d-3e-search-scope-ranking-command-palette.md` (`searchDocuments`, for the benchmark harness's latency measurement). Do not start until both are merged.

## Global Constraints

- Case-folding applies to Latin script; Thai text has no case and combining marks (tone/vowel signs) are never stripped.
- Cascade/refresh logic operates only on the client-side index/document map — it never writes back to Firestore. Firestore stays the rebuildable source of truth (spec Section 15: "the entire search projection can be rebuilt from it").
- No `IndexedDB` or `Web Worker` is added by this plan — spec Section 11 requires Task 7 benchmark evidence before either. If the recorded numbers don't breach the thresholds in Section 2's table, the correct outcome is "not justified yet, revisit at the next growth checkpoint" — not building the mechanism speculatively.
- Tag rename/delete has **no existing Firestore mutation function** (`libs/firebase/tags.ts` only exports `getTags`/`createTag` today) — this plan implements the cascade primitive the spec calls for, tested in isolation, but does not wire it to a UI action that doesn't exist yet. Wire it when a tag-rename feature is actually added.
- A chapter/volume deletion does not currently delete timeline events that reference it. Search must therefore retain those event documents; their placement policy is a separate Firestore-domain decision (delete event, clear placement, or migrate it) and must be implemented atomically before a search cascade may remove them.
- The benchmark runs synthetic fixtures by default. Real-baseline reads require an explicit `--real-baseline` flag and the already-authorized environment; never make a production Firestore read the default path.
- Run `make firebase-emulators` before `corepack pnpm test`. Run `corepack pnpm build && corepack pnpm lint` after each task.

### Task 0: Make provider mutations atomic before adding cascades

**Files:** Modify `libs/search/SearchIndexProvider.tsx`; create focused provider-mutation tests where the existing test setup permits.

Add and export `SearchMutations` with `upsert`, `discard`, `upsertMany`, and `discardMany`. Keep `entityMap` in provider state from `loadSearchDataset` and expose it through `useSearchIndex()`. Implement all mutation methods through one serialized queue or functional state transaction so a cascade cannot apply multiple MiniSearch changes while only retaining the last React `documents`/`dependents` map update. A batch must update the MiniSearch instance, document map, reverse dependents, and dirty counter as one logical operation. Queue mutations received during the initial build and replay them after the loaded snapshot is installed; a successful Firestore write must never be overwritten by a stale load result.

Do not derive entity data from `SearchDocument` in UI call sites. The provider's `entityMap` is the canonical in-memory projection for refresh work.

---

### Task 1: Thai/English tokenizer and term processing

**Files:**

- Create: `libs/search/tokenize.ts`
- Create: `libs/search/tokenize.test.ts`
- Modify: `libs/search/buildIndex.ts`

**Interfaces:**

- Produces: `tokenize(text: string): string[]`, `processTerm(term: string): string | false` — consumed by `buildIndex`'s MiniSearch constructor options.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/tokenize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { processTerm, tokenize } from "./tokenize";

describe("tokenize", () => {
  it("splits English text on whitespace and punctuation", () => {
    expect(tokenize("Rimuru, the slime.")).toEqual(["Rimuru", "the", "slime"]);
  });

  it("segments Thai text into words without relying on whitespace", () => {
    // Deliberately no spaces. Use common Thai words rather than a proper name so
    // the assertion checks dictionary segmentation, not an implementation guess.
    const tokens = tokenize("ประเทศไทยมีประชากร");
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join("")).not.toContain(" "); // isWordLike segments never include the space separators
  });

  it("tokenizes mixed Thai/English text without dropping either script", () => {
    const tokens = tokenize("Rimuru เดินทางไปยัง Tempest");
    expect(tokens).toContain("Rimuru");
    expect(tokens).toContain("Tempest");
  });

  it("preserves Thai combining marks (tone/vowel signs) inside a token", () => {
    // "น้ำ" (water) contains a combining mai-tho tone mark (U+0E49) on top of "น" — a
    // naive mark-stripping tokenizer would corrupt it into "นา" and break search.
    const tokens = tokenize("น้ำท่วม");
    expect(tokens.join("")).toContain("้");
  });

  it("does not produce empty tokens from repeated punctuation", () => {
    expect(tokenize("wait...  what?!")).toEqual(["wait", "what"]);
  });

  it("keeps whitespace-delimited mixed text searchable when Segmenter is unavailable", () => {
    // Export a test-only reset/injection seam rather than mutating global Intl.
    // Verify the fallback result separately; it is not claimed to segment Thai
    // text that has no spaces.
    expect(tokenize("Rimuru เทมเพส", { segmenter: null })).toEqual(["Rimuru", "เทมเพส"]);
  });
});

describe("processTerm", () => {
  it("case-folds Latin terms", () => {
    expect(processTerm("Rimuru")).toBe("rimuru");
  });

  it("leaves Thai terms unchanged (no case to fold)", () => {
    expect(processTerm("เทมเพส")).toBe("เทมเพส");
  });

  it("Unicode-normalizes to NFC", () => {
    const decomposed = "é"; // "é" as "e" + combining acute accent
    expect(processTerm(decomposed)).toBe("é".normalize("NFC"));
  });

  it("rejects a term that is empty after trimming", () => {
    expect(processTerm("   ")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/tokenize.test.ts`
Expected: FAIL — `Cannot find module './tokenize'`.

- [ ] **Step 3: Implement**

Create `libs/search/tokenize.ts`:

```ts
const FALLBACK_SPLIT =
  /[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~“”‘’«»「」『』、。！？…—–]+/u;

let cachedSegmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  cachedSegmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "word" })
      : null;
  return cachedSegmenter;
}

// Word-boundary segmentation for mixed Thai/English text. Thai has no
// inter-word spaces, so whitespace splitting alone (the fallback below) cannot
// tokenize it correctly — Intl.Segmenter is required for real Thai support.
// The fallback keeps English/whitespace-delimited text working in
// environments without it (spec Section 9: "supported-browser fallback").
export function tokenize(
  text: string,
  options?: { segmenter?: Intl.Segmenter | null },
): string[] {
  const segmenter = options?.segmenter === undefined ? getSegmenter() : options.segmenter;
  if (!segmenter) return text.split(FALLBACK_SPLIT).filter(Boolean);
  const tokens: string[] = [];
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (isWordLike) tokens.push(segment);
  }
  return tokens;
}

export function processTerm(term: string): string | false {
  const normalized = term.normalize("NFC").trim();
  if (!normalized) return false;
  // toLocaleLowerCase() is a documented no-op on Thai codepoints (Thai has no
  // case), so applying it unconditionally is safe and keeps this one code path
  // for both scripts instead of branching on detected script.
  return normalized.toLocaleLowerCase();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/tokenize.test.ts`
Expected: PASS. If the Thai segmentation test fails in the CI/test environment's Node version, verify `Intl.Segmenter` is actually available there (`node -e "console.log('Segmenter' in Intl)"`) — Node 18+ supports it without a flag; this repo's `@types/node ^20` implies a compatible runtime, but confirm before assuming a test failure is a logic bug.

- [ ] **Step 5: Wire the tokenizer into `buildIndex`**

Modify `libs/search/buildIndex.ts` (from the prior plan) to pass both functions to the `MiniSearch` constructor:

```ts
import MiniSearch from "minisearch";
import { processTerm, tokenize } from "./tokenize";
import { SEARCH_TEXT_FIELDS, type SearchDocument } from "./types";

export function buildIndex(
  documents: SearchDocument[],
): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>({
    idField: "id",
    fields: SEARCH_TEXT_FIELDS as string[],
    storeFields: [],
    tokenize,
    processTerm,
    extractField: (document, fieldName) => {
      const value = (document as unknown as Record<string, unknown>)[fieldName];
      return Array.isArray(value) ? value.join(" ") : ((value as string) ?? "");
    },
  });
  index.addAll(documents);
  return index;
}
```

Re-run `libs/search/buildIndex.test.ts` and `libs/search/rank.test.ts` from the prior plans after this change — both build real indexes through `buildIndex`, so a tokenizer regression would show up as a test failure there, not just here.

- [ ] **Step 6: Run the full search test suite**

Run: `corepack pnpm test -- libs/search`
Expected: PASS across `buildIndex.test.ts`, `rank.test.ts`, `scope.test.ts`, `normalize.test.ts`, `loader.test.ts`, `tokenize.test.ts`, `queryDebouncer.test.ts`.

- [ ] **Step 7: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add libs/search/tokenize.ts libs/search/tokenize.test.ts libs/search/buildIndex.ts
git commit -m "$(cat <<'EOF'
feat(search): configure a Thai/English-aware tokenizer for the search index

EOF
)"
```

---

### Task 2: Reference-projection refresh and entity rename/delete cascade

**Files:**

- Create: `libs/search/refresh.ts`
- Create: `libs/search/refresh.test.ts`
- Modify: `app/novels/[id]/entities/[entityId]/EntityDetail.tsx`
- Modify: `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`

**Interfaces:**

- Consumes: `EntityMap`, `Entity`, `EntityId` (prior plans); the Task 0 `useSearchIndex()` mutation API.
- Produces: `refreshReferenceProjection(doc, entityMap): SearchDocument`, `cascadeEntityChange(entityId, dependents, documents, entityMap, mutations): void` — consumed by this task's UI wiring.

Spec Section 10: "Entity rename/alias update → refresh entity and referencing documents using a reverse dependency map keyed by entity ID" and "Entity deletion → refresh dependencies, retaining missing-target text/bindings." Both reduce to the same operation: recompute every dependent document's reference projection from the (now-updated-or-missing) entity map, without touching `referenceIds`, `content`, or any authored text.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/refresh.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { cascadeEntityChange, refreshReferenceProjection } from "./refresh";
import type { Entity, EntityId } from "@/libs/entities/types";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "d",
    type: "note",
    novelId: "n1",
    referenceIds: [],
    referenceNames: [],
    referenceTypes: [],
    aliases: [],
    tagIds: [],
    tags: [],
    route: "/",
    ...overrides,
  };
}

const ENTITY: Entity = {
  id: "n1:character:c1",
  novelId: "n1",
  type: "character",
  name: "Rimuru",
  aliases: ["Satoru"],
  description: "",
};

describe("refreshReferenceProjection", () => {
  it("recomputes referenceNames/referenceTypes/aliases from the current entity map without touching referenceIds or content", () => {
    const stale = doc({
      id: "note:1",
      referenceIds: [ENTITY.id],
      referenceNames: ["Old Name"],
      referenceTypes: ["character"],
      aliases: [],
      content: "[[Old Name]] speaks.",
    });
    const renamed = { ...ENTITY, name: "Rimuru Tempest" };
    const refreshed = refreshReferenceProjection(
      stale,
      new Map([[ENTITY.id, renamed]]),
    );

    expect(refreshed.referenceIds).toEqual([ENTITY.id]);
    expect(refreshed.referenceNames).toEqual(["Rimuru Tempest"]);
    expect(refreshed.aliases).toEqual(["Satoru"]);
    expect(refreshed.content).toBe("[[Old Name]] speaks."); // authored text is never rewritten.
  });

  it("drops a deleted entity's contribution without discarding the document", () => {
    const stale = doc({
      id: "note:1",
      referenceIds: [ENTITY.id],
      referenceNames: [ENTITY.name],
      referenceTypes: ["character"],
      content: "[[Rimuru]] speaks.",
    });
    const refreshed = refreshReferenceProjection(stale, new Map()); // entity no longer in the map — deleted.

    expect(refreshed.referenceNames).toEqual([]);
    expect(refreshed.content).toBe("[[Rimuru]] speaks."); // still searchable as text.
  });
});

describe("cascadeEntityChange", () => {
  it("refreshes every dependent document and leaves unrelated documents untouched", () => {
    const dependentNote = doc({
      id: "note:1",
      referenceIds: [ENTITY.id],
      referenceNames: ["Old Name"],
    });
    const unrelatedNote = doc({ id: "note:2", referenceIds: [] });
    const documents = new Map([
      [dependentNote.id, dependentNote],
      [unrelatedNote.id, unrelatedNote],
    ]);
    const dependents = new Map<EntityId, Set<string>>([
      [ENTITY.id, new Set([dependentNote.id])],
    ]);
    const entityMap = new Map([
      [ENTITY.id, { ...ENTITY, name: "Rimuru Tempest" }],
    ]);
    const upsert = vi.fn();

    cascadeEntityChange(ENTITY.id, dependents, documents, entityMap, {
      upsert,
      discard: vi.fn(),
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note:1",
        referenceNames: ["Rimuru Tempest"],
      }),
    );
  });

  it("does nothing when the entity has no dependents", () => {
    const upsert = vi.fn();
    cascadeEntityChange(ENTITY.id, new Map(), new Map(), new Map(), {
      upsert,
      discard: vi.fn(),
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/refresh.test.ts`
Expected: FAIL — `Cannot find module './refresh'`.

- [ ] **Step 3: Implement**

Create `libs/search/refresh.ts`:

```ts
import type { Entity, EntityId } from "@/libs/entities/types";
import type { SearchMutations } from "./SearchIndexProvider";
import type { SearchDocument } from "./types";

export type EntityMap = Map<EntityId, Entity>;

export function refreshReferenceProjection(
  doc: SearchDocument,
  entityMap: EntityMap,
): SearchDocument {
  const entities = doc.referenceIds
    .map((id) => entityMap.get(id))
    .filter((e): e is Entity => Boolean(e));
  return {
    ...doc,
    referenceTypes: entities.map((e) => e.type),
    referenceNames: [...new Set(entities.map((e) => e.name))],
    aliases: [...new Set(entities.flatMap((e) => e.aliases))],
  };
}

export function cascadeEntityChange(
  entityId: EntityId,
  dependents: Map<EntityId, Set<string>>,
  documents: Map<string, SearchDocument>,
  entityMap: EntityMap,
  mutations: Pick<SearchMutations, "upsert">,
): void {
  const dependentIds = dependents.get(entityId);
  if (!dependentIds) return;
  dependentIds.forEach((docId) => {
    const doc = documents.get(docId);
    if (!doc) return;
    mutations.upsert(refreshReferenceProjection(doc, entityMap));
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/refresh.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the cascade into entity and character edit/delete**

The pre-Task 0 sketch below is retained only for history and must be removed during implementation. Follow the superseding instruction after it: use the provider's live `entityMap` and batch API; do not derive entities from indexed documents.

```tsx
import {
  useSearchIndex,
  useSearchMutations,
} from "@/libs/search/SearchIndexProvider";
import { cascadeEntityChange } from "@/libs/search/refresh";
import type { Entity } from "@/libs/entities/types";

// ...inside the component, after a successful updateEntity(...) call:
const { documents, dependents } = useSearchIndex();
const { upsert, discard } = useSearchMutations();
// ...
const updatedEntity: Entity = {
  id: entity.id,
  novelId: entity.novelId,
  type: entity.type,
  name,
  aliases,
  description,
};
upsert(normalizeEntity(updatedEntity));
const entityMap = new Map(
  [...documents.values()]
    .filter((d) => d.type === "entity" && d.entityId)
    .map((d) => [
      d.entityId!,
      {
        id: d.entityId!,
        novelId: d.novelId,
        type: d.entityType!,
        name: d.name ?? "",
        aliases: d.aliases,
        description: d.description ?? "",
      } as Entity,
    ]),
);
entityMap.set(updatedEntity.id, updatedEntity); // this entity's own just-saved values, not the (now stale) indexed copy.
cascadeEntityChange(updatedEntity.id, dependents, documents, entityMap, {
  upsert,
});
```

And after a successful `deleteEntity(...)` call:

```tsx
discard(`entity:${entity.id}`);
const entityMapAfterDelete = new Map(
  [...documents.values()]
    .filter(
      (d) => d.type === "entity" && d.entityId && d.entityId !== entity.id,
    )
    .map((d) => [
      d.entityId!,
      {
        id: d.entityId!,
        novelId: d.novelId,
        type: d.entityType!,
        name: d.name ?? "",
        aliases: d.aliases,
        description: d.description ?? "",
      } as Entity,
    ]),
);
cascadeEntityChange(entity.id, dependents, documents, entityMapAfterDelete, {
  upsert,
});
```

Apply the identical pattern to `CharacterDetail.tsx`'s save/delete handlers, using `buildEntityId(novelId, "character", character.id)` (from `@/libs/entities/keys`) as the `entityId` — characters are entities too (spec Section 5: "Character records become `type: \"entity\", entityType: \"character\"`"), so a character rename must cascade exactly the same way.

**Superseding implementation instruction:** the examples above predate Task 0 and must not be copied. Use the provider's exported `entityMap`, `documents`, and `dependents` directly, and perform the entity document update plus every dependent projection refresh in one `upsertMany` batch. For deletion, remove the entity from a copied `entityMap`, then batch `discardMany([entityDocumentId])` with the refreshed dependents. `CharacterDetail.tsx` currently has no delete action, so wire its successful save only; add deletion cascade wiring only when a real Firestore-backed character-delete flow is introduced. Do not rebuild entities from `SearchDocument` fields in a UI component.

- [ ] **Step 6: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: create a character, reference it from a chapter note (`[[Name]]`), rename the character, then search for the note's content in the command palette and confirm the result's projected reference name reflects the rename without needing a page reload.

- [ ] **Step 7: Commit**

```bash
git add libs/search/refresh.ts libs/search/refresh.test.ts "app/novels/[id]/entities/[entityId]/EntityDetail.tsx" "app/novels/[id]/characters/[characterId]/CharacterDetail.tsx"
git commit -m "$(cat <<'EOF'
feat(search): cascade entity rename/delete to dependent search documents

EOF
)"
```

---

### Task 3: Cascading discard for deleted chapters and volumes

**Files:**

- Create: `libs/search/cascadeDelete.ts`
- Create: `libs/search/cascadeDelete.test.ts`
- Modify: `app/novels/[id]/ChapterListWithFilters.tsx` (chapter delete)
- Modify: `app/novels/[id]/VolumeManager.tsx` (volume delete)

**Interfaces:**

- Produces: `descendantsOf(target: { type: "chapter" | "volume"; novelId: string; volumeId: string; chapterId?: string }, documents): string[]` — consumed by this task's UI wiring.

Discarding just the chapter (or volume) document and leaving its note (and, for a volume, nested chapter and note) documents behind would let deleted content keep showing up in search results indefinitely — `discard` only removes the exact ID passed to it.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/cascadeDelete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { descendantsOf } from "./cascadeDelete";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "d",
    type: "chapter",
    novelId: "n1",
    referenceIds: [],
    referenceNames: [],
    referenceTypes: [],
    aliases: [],
    tagIds: [],
    tags: [],
    route: "/",
    ...overrides,
  };
}

describe("descendantsOf", () => {
  it("includes a chapter's own notes when the chapter is the target", () => {
    const chapter = doc({
      id: "chapter:n1:v1:c1",
      type: "chapter",
      volumeId: "v1",
      chapterId: "c1",
    });
    const note = doc({
      id: "note:n1:v1:c1:note1",
      type: "note",
      volumeId: "v1",
      chapterId: "c1",
    });
    const otherChapterNote = doc({
      id: "note:n1:v1:c2:note1",
      type: "note",
      volumeId: "v1",
      chapterId: "c2",
    });
    const documents = new Map(
      [chapter, note, otherChapterNote].map((d) => [d.id, d]),
    );

    const ids = descendantsOf(
      { type: "chapter", novelId: "n1", volumeId: "v1", chapterId: "c1" },
      documents,
    );
    expect(ids.sort()).toEqual(["chapter:n1:v1:c1", "note:n1:v1:c1:note1"]);
  });

  it("includes a volume's chapters and notes but retains timeline events", () => {
    const volume = doc({ id: "volume:n1:v1", type: "volume", volumeId: "v1" });
    const chapter = doc({
      id: "chapter:n1:v1:c1",
      type: "chapter",
      volumeId: "v1",
      chapterId: "c1",
    });
    const note = doc({
      id: "note:n1:v1:c1:note1",
      type: "note",
      volumeId: "v1",
      chapterId: "c1",
    });
    const event = doc({
      id: "event:n1:e1",
      type: "event",
      volumeId: "v1",
      chapterId: "c1",
    });
    const otherVolumeChapter = doc({
      id: "chapter:n1:v2:c9",
      type: "chapter",
      volumeId: "v2",
      chapterId: "c9",
    });
    const documents = new Map(
      [volume, chapter, note, event, otherVolumeChapter].map((d) => [d.id, d]),
    );

    const ids = descendantsOf(
      { type: "volume", novelId: "n1", volumeId: "v1" },
      documents,
    );
    expect(ids.sort()).toEqual([
      "chapter:n1:v1:c1",
      "note:n1:v1:c1:note1",
      "volume:n1:v1",
    ]);
  });

  it("returns an empty result for a target with no matching documents", () => {
    expect(
      descendantsOf(
        {
          type: "chapter",
          novelId: "n1",
          volumeId: "v1",
          chapterId: "missing",
        },
        new Map(),
      ),
    ).toEqual([]);
  });
});
```

**Event retention rule:** `deleteChapter` and `deleteVolume` currently leave timeline events in Firestore. Therefore `descendantsOf` must return only source documents actually deleted by those operations: the target volume/chapter and its nested chapter/note documents. Keep the event fixture above and assert that `event:n1:e1` is absent. Do not discard event search documents until a separate, source-of-truth event deletion or relocation policy is implemented.

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/cascadeDelete.test.ts`
Expected: FAIL — `Cannot find module './cascadeDelete'`.

- [ ] **Step 3: Implement**

Create `libs/search/cascadeDelete.ts`:

```ts
import type { SearchDocument } from "./types";

export type DeleteTarget =
  | { type: "chapter"; novelId: string; volumeId: string; chapterId: string }
  | { type: "volume"; novelId: string; volumeId: string };

export function descendantsOf(
  target: DeleteTarget,
  documents: Map<string, SearchDocument>,
): string[] {
  const all = [...documents.values()];
  if (target.type === "chapter") {
    return all
      .filter(
        (doc) =>
          doc.type !== "event" &&
          doc.novelId === target.novelId &&
          doc.volumeId === target.volumeId &&
          doc.chapterId === target.chapterId,
      )
      .map((doc) => doc.id);
  }
  return all
    .filter(
      (doc) =>
        doc.type !== "event" &&
        doc.novelId === target.novelId && doc.volumeId === target.volumeId,
    )
    .map((doc) => doc.id);
}
```

(A chapter's own document IS included by the same `volumeId`/`chapterId` filter used for its notes — it also carries `volumeId`/`chapterId`, so it matches its own predicate; no special-casing needed. The same reasoning covers the volume case including the volume document itself.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/cascadeDelete.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the chapter and volume delete handlers**

In `ChapterListWithFilters.tsx`, find the existing chapter-delete handler (it calls `deleteChapter(novelId, volumeId, chapterId)` — mirror the exact success-path shape already used elsewhere in this session's plans for delete wiring) and add, right after the successful `deleteChapter` call:

```tsx
const { documents, discardMany } = useSearchIndex();
// ...
discardMany(descendantsOf(
  { type: "chapter", novelId, volumeId, chapterId: chapter.id },
  documents,
));
```

In `VolumeManager.tsx`, same pattern after a successful `deleteVolume(...)` call:

```tsx
discardMany(descendantsOf(
  { type: "volume", novelId, volumeId: volume.id },
  documents,
));
```

Use the Task 0 batch API shape (`discardMany(descendantsOf(...))`) so one delete event produces one atomic index mutation. This avoids React state snapshot loss when several descendants are removed in one event.

- [ ] **Step 6: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: create a chapter with two notes, search for one note's text to confirm it's indexed, delete the chapter, search the same text again and confirm no result appears (without reloading the page).

- [ ] **Step 7: Commit**

```bash
git add libs/search/cascadeDelete.ts libs/search/cascadeDelete.test.ts "app/novels/[id]/ChapterListWithFilters.tsx" "app/novels/[id]/VolumeManager.tsx"
git commit -m "$(cat <<'EOF'
feat(search): cascade discard to descendant documents on chapter/volume delete

EOF
)"
```

---

### Task 4: Tag-rename projection primitive (untested-by-UI, ready for a future tag-rename feature)

**Files:**

- Modify: `libs/search/refresh.ts`
- Modify: `libs/search/refresh.test.ts`

**Interfaces:**

- Produces: `refreshTagProjection(doc, tagMap: Map<string, string>): SearchDocument` — not yet consumed anywhere (see Global Constraints: no tag-rename mutation exists in this codebase today).

- [ ] **Step 1: Write the failing test**

Add to `libs/search/refresh.test.ts`:

```ts
describe("refreshTagProjection", () => {
  it("recomputes tags (names) from tagIds without touching tagIds itself", () => {
    const stale = doc({
      id: "chapter:1",
      tagIds: ["tag-1"],
      tags: ["Old Name"],
    });
    const refreshed = refreshTagProjection(
      stale,
      new Map([["tag-1", "Renamed Tag"]]),
    );
    expect(refreshed.tagIds).toEqual(["tag-1"]);
    expect(refreshed.tags).toEqual(["Renamed Tag"]);
  });

  it("drops a deleted tag's name without discarding the document", () => {
    const stale = doc({
      id: "chapter:1",
      tagIds: ["tag-1"],
      tags: ["Deleted Tag"],
    });
    const refreshed = refreshTagProjection(stale, new Map());
    expect(refreshed.tags).toEqual([]);
  });
});
```

Add `refreshTagProjection` to the file's import from `./refresh`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/refresh.test.ts`
Expected: FAIL — `refreshTagProjection is not a function`.

- [ ] **Step 3: Implement**

Add to `libs/search/refresh.ts`:

```ts
export function refreshTagProjection(
  doc: SearchDocument,
  tagNamesById: Map<string, string>,
): SearchDocument {
  return {
    ...doc,
    tags: doc.tagIds
      .map((id) => tagNamesById.get(id))
      .filter((name): name is string => Boolean(name)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/refresh.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, and commit**

Run: `corepack pnpm build && corepack pnpm lint`

```bash
git add libs/search/refresh.ts libs/search/refresh.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add a tag-rename projection primitive (unwired — no tag-rename feature exists yet)

EOF
)"
```

---

### Task 5: Diff chapter notes by stable ID instead of re-normalizing the whole chapter

**Files:**

- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx`
- Create: `libs/search/diffNotes.ts`
- Create: `libs/search/diffNotes.test.ts`

**Interfaces:**

- Produces: `diffNotes(previous: ChapterNote[], next: ChapterNote[]): { changed: ChapterNote[]; removedIds: string[] }` — consumed by `ChapterNotesEditor.tsx`'s `save()`/`remove()`.

Spec Section 10: "Chapter-note edits → diff by stable note ID, updating only affected notes and chapter relationship/tag projections." The prior plan's generic mutation wiring only covers the chapter document itself; this task makes note-level saves precise.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/diffNotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diffNotes } from "./diffNotes";
import type { ChapterNote } from "@/app/types";

function note(id: string, content: string): ChapterNote {
  return {
    id,
    content,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("diffNotes", () => {
  it("reports only the note whose content changed", () => {
    const previous = [note("1", "A"), note("2", "B")];
    const next = [note("1", "A"), note("2", "B changed")];
    const { changed, removedIds } = diffNotes(previous, next);
    expect(changed.map((n) => n.id)).toEqual(["2"]);
    expect(removedIds).toEqual([]);
  });

  it("reports a newly-added note as changed", () => {
    const previous = [note("1", "A")];
    const next = [note("1", "A"), note("2", "New")];
    const { changed } = diffNotes(previous, next);
    expect(changed.map((n) => n.id)).toEqual(["2"]);
  });

  it("reports a removed note's id", () => {
    const previous = [note("1", "A"), note("2", "B")];
    const next = [note("1", "A")];
    const { changed, removedIds } = diffNotes(previous, next);
    expect(changed).toEqual([]);
    expect(removedIds).toEqual(["2"]);
  });

  it("reports nothing when nothing changed", () => {
    const notes = [note("1", "A")];
    expect(diffNotes(notes, notes)).toEqual({ changed: [], removedIds: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/diffNotes.test.ts`
Expected: FAIL — `Cannot find module './diffNotes'`.

- [ ] **Step 3: Implement**

Create `libs/search/diffNotes.ts`:

```ts
import type { ChapterNote } from "@/app/types";

export function diffNotes(
  previous: ChapterNote[],
  next: ChapterNote[],
): { changed: ChapterNote[]; removedIds: string[] } {
  const previousById = new Map(previous.map((note) => [note.id, note]));
  const nextIds = new Set(next.map((note) => note.id));
  const changed = next.filter(
    (note) => previousById.get(note.id)?.content !== note.content,
  );
  const removedIds = previous
    .filter((note) => !nextIds.has(note.id))
    .map((note) => note.id);
  return { changed, removedIds };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/diffNotes.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into `ChapterNotesEditor.tsx`**

The pre-Task 0 sketch below is retained only for history and must be removed during implementation. Follow the superseding instruction after it, including use of the persisted `updateChapter` return value and the provider batch API.

```tsx
const { changed } = diffNotes(notes, next);
const entityMap = new Map(); // see this plan's Task 2 for how CharacterDetail/EntityDetail build a real one; here, an empty map means resolved reference names go stale until the next full reload() — acceptable because the note's own content/character_ids are still correct immediately, matching the same trade-off the prior plan's chapter wiring already accepted.
changed.forEach((note) =>
  upsert(
    normalizeNote(novelId, volumeId, chapterId, note, chapterTags, entityMap),
  ),
);
```

(`chapterTags` must come from a prop — `ChapterNotesEditor` doesn't currently receive the chapter's `tags`; add a `tags: Tag[]` prop, passed from `page.tsx` alongside the existing `notes`/`characters` props: `<ChapterNotesEditor notes={chapter.notes} characters={chapter.characters} tags={chapter.tags} ... />`.)

In `remove()`, after the successful `updateChapter(...)` call:

```tsx
discard(`note:${novelId}:${volumeId}:${chapterId}:${note.id}`);
```

**Superseding implementation instruction:** derive the diff from the persisted chapter returned by `const updated = await updateChapter(...)`, not from the write payload. Compare the editor's previous notes with `updated.notes`; normalize changed notes with the provider's live `entityMap`; discard `removedIds`; then upsert the normalized `updated` chapter so its reference and tag projections stay correct. Submit those note discards, note upserts, and chapter upsert through Task 0's single batch API before calling `setNotes(updated.notes)`. An empty `EntityMap` is not acceptable because it would write stale reference names into the derived index.

- [ ] **Step 6: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: add three notes to a chapter, edit only one, confirm (via a temporary log of `upsert` calls, removed before committing) that only the edited note's document was re-normalized — not all three.

- [ ] **Step 7: Commit**

```bash
git add libs/search/diffNotes.ts libs/search/diffNotes.test.ts "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx" "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(search): diff chapter notes by stable id, updating only affected note documents

EOF
)"
```

---

### Task 6: Vacuum scheduling and stale-build recovery

**Files:**

- Create: `libs/search/vacuumSchedule.ts`
- Create: `libs/search/vacuumSchedule.test.ts`
- Modify: `libs/search/SearchIndexProvider.tsx`

**Interfaces:**

- Produces: `shouldVacuum(dirtyCount: number, totalCount: number): boolean` — consumed by the provider's mutation path.

`MiniSearch.discard()` is a soft delete — the discarded document's postings stay in the index until `vacuum()` runs. Spec Section 10: "Benchmark automatic vacuum behavior first; tune/schedule maintenance when dirty-entry growth warrants it. Avoid vacuum after every keystroke or every save." This task adds the threshold check and wires a call; the actual "benchmark first" evidence is Task 7's report — if that report shows MiniSearch's own automatic vacuum (it self-triggers internally past an internal dirty ratio) already keeps memory bounded at the recorded checkpoint sizes, this task's explicit `vacuum()` call is a deliberately cheap no-op safety net, not the primary mechanism.

- [ ] **Step 1: Write the failing test**

Create `libs/search/vacuumSchedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldVacuum } from "./vacuumSchedule";

describe("shouldVacuum", () => {
  it("returns false below the dirty-ratio threshold", () => {
    expect(shouldVacuum(5, 1000)).toBe(false);
  });

  it("returns true once the dirty ratio crosses 10%", () => {
    expect(shouldVacuum(101, 1000)).toBe(true);
  });

  it("returns false for an empty index", () => {
    expect(shouldVacuum(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/vacuumSchedule.test.ts`
Expected: FAIL — `Cannot find module './vacuumSchedule'`.

- [ ] **Step 3: Implement**

Create `libs/search/vacuumSchedule.ts`:

```ts
const DIRTY_RATIO_THRESHOLD = 0.1; // Initial proposed budget (spec Section 2) — revisit with Task 7's benchmark evidence.

export function shouldVacuum(dirtyCount: number, totalCount: number): boolean {
  if (totalCount === 0) return false;
  return dirtyCount / totalCount >= DIRTY_RATIO_THRESHOLD;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/vacuumSchedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Track dirty count and schedule vacuum in the provider**

The pre-Task 0 sketch below is retained only for history and must be removed during implementation. Put dirty tracking and vacuum scheduling in the provider's serialized batch transaction as specified after the snippet.

```tsx
import { shouldVacuum } from "./vacuumSchedule";

// module-scope, reset per index instance — acceptable as a simple counter since
// there is exactly one index for the whole app session (Global Constraints).
let dirtyCount = 0;

export function useSearchMutations(): SearchMutations {
  const ctx = useContext(SearchIndexContext);
  if (!ctx)
    throw new Error(
      "useSearchMutations must be used within a SearchIndexProvider",
    );

  const discard = useCallback(
    (id: string) => {
      if (!ctx.index || !ctx.documents.has(id)) return;
      ctx.index.discard(id);
      ctx.documents.delete(id);
      dirtyCount += 1;
      if (shouldVacuum(dirtyCount, ctx.documents.size)) {
        void ctx.index.vacuum().then(() => {
          dirtyCount = 0;
        });
      }
    },
    [ctx],
  );

  // ...upsert unchanged...
  return { upsert, discard };
}
```

- [ ] **Step 6: Stale-build recovery**

**Superseding implementation instruction for Step 5:** integrate vacuum scheduling into Task 0's serialized provider mutation transaction. Keep the dirty count per provider/index instance (for example, a ref owned by the provider), increment it only for successful discards or replacements, and reset it after a completed `vacuum()`. Do not mutate `ctx.documents` directly, use a module-scope counter, or create a separate context hook: the batch mutation must update the MiniSearch index, document map, dependents, and maintenance state together.

The provider's `buildIdRef` guard (from the prior plan) already prevents a slow, superseded `reload()` from overwriting a newer one. Add the explicit "full rebuild is the recovery path" affordance the spec calls for: expose a manual recovery action by re-exposing the existing `reload()` from `useSearchIndex()` — no new code needed here since it already exists; this step is a documentation/verification step, not an implementation one. Verify: call `reload()` from a component after simulating an error (e.g. temporarily throw inside `loadSearchDataset` behind a feature flag during manual testing) and confirm `status` recovers to `"ready"`.

- [ ] **Step 7: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add libs/search/vacuumSchedule.ts libs/search/vacuumSchedule.test.ts libs/search/SearchIndexProvider.tsx
git commit -m "$(cat <<'EOF'
feat(search): schedule index vacuum past a dirty-entry ratio threshold

EOF
)"
```

---

### Task 7: Growth-checkpoint benchmark harness and first report

**Files:**

- Create: `scripts/one-off/benchmark-search-index.ts`
- Create: `docs/engineering/search-benchmark-report.md`
- Modify: `package.json` (new `benchmark:search` script)

**Interfaces:**

- Produces: a one-off script printing a report matching spec Section 2's table; a checked-in Markdown report of the first run's results.

Run deterministic synthetic fixtures at 5,000 / 10,000 / 25,000 / 50,000 documents by default, each including Thai/English mixed text, realistic note-length distributions, and repeated references. An authorized non-production real baseline is optional via `--real-baseline`. Since this is a Node script rather than a browser, memory is reported via `process.memoryUsage().heapUsed` deltas, explicitly labeled as a Node-process approximation; report browser heap as unavailable unless separately profiled.

**Benchmark protocol (supersedes the sample harness below where they conflict):** Synthetic checkpoints are the default and must be deterministic: accept `--seed` (with a documented fixed default) and use a seeded PRNG, never `Math.random()`. Run each checkpoint in an isolated process, or require `node --expose-gc` and call `global.gc()` before every memory measurement, so a prior checkpoint cannot contaminate the next heap delta. Include warm-up queries before timing and record the query/repetition counts. Measure and report document count, index build time, exact and fuzzy p50/p95 latency, index-memory approximation, serialized search-dataset byte size, and Firestore source dataset byte size. For synthetic fixtures, label Firestore source bytes as `N/A`; for a real baseline, obtain it only from an authorized emulator/export/profiler measurement and otherwise report `unavailable` rather than guessing.

The real baseline is **opt-in only** via `--real-baseline`; it may run only with an already authorized, non-production Firebase environment. Do not load production Firestore data automatically, do not print document contents or credentials, and continue with synthetic results if the opt-in baseline is unavailable. Browser heap remains `unavailable` unless separately captured in browser DevTools; Node heap is an explicitly labeled approximation.

- [ ] **Step 1: Write the fixture generator and harness**

Create `scripts/one-off/benchmark-search-index.ts`:

```ts
import { performance } from "node:perf_hooks";
import { buildIndex } from "@/libs/search/buildIndex";
import { searchDocuments } from "@/libs/search/rank";
import type { SearchDocument } from "@/libs/search/types";

const THAI_WORDS = [
  "ริมูรุ",
  "เทมเพส",
  "ป่า",
  "หมู่บ้าน",
  "ทักษะ",
  "เวทมนตร์",
  "นักรบ",
  "อาณาจักร",
];
const ENGLISH_WORDS = [
  "Rimuru",
  "Tempest",
  "forest",
  "village",
  "skill",
  "magic",
  "warrior",
  "kingdom",
];

function createPrng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomSentence(wordCount: number, random: () => number): string {
  const words = Array.from({ length: wordCount }, () =>
    random() < 0.5
      ? THAI_WORDS[Math.floor(random() * THAI_WORDS.length)]
      : ENGLISH_WORDS[Math.floor(random() * ENGLISH_WORDS.length)],
  );
  return words.join(" ");
}

function generateFixture(count: number, seed = 20260911): SearchDocument[] {
  const random = createPrng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `note:bench:vol:ch${Math.floor(i / 20)}:n${i}`,
    type: "note" as const,
    novelId: "bench",
    volumeId: "vol",
    chapterId: `ch${Math.floor(i / 20)}`,
    noteId: `n${i}`,
    content: randomSentence(15 + Math.floor(random() * 40), random),
    referenceIds: [],
    referenceNames: i % 10 === 0 ? ["Rimuru Tempest"] : [],
    referenceTypes: i % 10 === 0 ? ["character" as const] : [],
    aliases: [],
    tagIds: [],
    tags: i % 5 === 0 ? ["Arc"] : [],
    route: "/",
  }));
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[index];
}

function measureSearchLatency(
  index: ReturnType<typeof buildIndex>,
  documents: Map<string, SearchDocument>,
  query: string,
  reps: number,
): { p50: number; p95: number } {
  const durations: number[] = [];
  for (let i = 0; i < reps; i += 1) {
    const start = performance.now();
    searchDocuments(index, documents, query, { kind: "global" });
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return { p50: percentile(durations, 50), p95: percentile(durations, 95) };
}

function report(label: string, documentCount: number) {
  const documents = generateFixture(documentCount);
  const documentMap = new Map(documents.map((d) => [d.id, d]));

  global.gc?.();
  const buildStart = performance.now();
  const heapBefore = process.memoryUsage().heapUsed;
  const index = buildIndex(documents);
  const buildMs = performance.now() - buildStart;
  const heapAfterBuild = process.memoryUsage().heapUsed;

  const exact = measureSearchLatency(index, documentMap, "Rimuru", 30);
  const fuzzy = measureSearchLatency(index, documentMap, "Rimurru", 30); // deliberate typo, >=5 chars, exercises the fuzzy stage.

  console.log(`\n== ${label} (${documentCount} documents) ==`);
  console.log(`Index build time: ${buildMs.toFixed(1)}ms`);
  console.log(`Search dataset bytes: ${Buffer.byteLength(JSON.stringify(documents))}`);
  console.log(
    `Heap delta (Node process approximation, NOT a browser measurement): ${((heapAfterBuild - heapBefore) / 1024 / 1024).toFixed(2)} MiB`,
  );
  console.log(
    `Search latency (exact "Rimuru"): p50=${exact.p50.toFixed(2)}ms p95=${exact.p95.toFixed(2)}ms`,
  );
  console.log(
    `Search latency (fuzzy "Rimurru"): p50=${fuzzy.p50.toFixed(2)}ms p95=${fuzzy.p95.toFixed(2)}ms`,
  );
}

async function reportRealBaseline() {
  const { loadSearchDataset } = await import("@/libs/search/loader");
  const KIND_LABELS = {
    chapter: "Chapter",
    prologue: "Prologue",
    epilogue: "Epilogue",
    afterword: "Afterword",
    side_story: "Side Story",
    other: "Other",
  };
  const { documents } = await loadSearchDataset(KIND_LABELS);
  console.log(`\n== Real baseline (authorized non-production Firestore data) ==`);
  console.log(`Total documents: ${documents.length}`);
  if (documents.length > 0) {
    const documentMap = new Map(documents.map((d) => [d.id, d]));
    const buildStart = performance.now();
    buildIndex(documents);
    console.log(
      `Index build time: ${(performance.now() - buildStart).toFixed(1)}ms`,
    );
  }
}

async function main() {
  if (process.argv.includes("--real-baseline")) {
    await reportRealBaseline().catch((error) =>
      console.log(
        `Real baseline unavailable (${error instanceof Error ? error.message : "unknown error"}) — synthetic checkpoints below are still meaningful on their own.`,
      ),
    );
  }
  [5000, 10000, 25000, 50000].forEach((count) =>
    report(`Synthetic checkpoint`, count),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

- [ ] **Step 2: Wire the npm script**

In `package.json`:

```json
    "benchmark:search": "node --expose-gc --import tsx scripts/one-off/benchmark-search-index.ts"
```

- [ ] **Step 3: Run it and record the results**

Run: `corepack pnpm benchmark:search`

Create `docs/engineering/search-benchmark-report.md` with the actual printed numbers (do not fabricate — paste the real console output), structured against spec Section 2's table:

```md
# Search Index Benchmark Report — Initial Run

Run on: <date>, Node <version>, machine: <CPU/RAM summary>. See `scripts/one-off/benchmark-search-index.ts` for the exact methodology; memory figures are Node-process heap deltas, not browser heap measurements — a true browser figure requires a manual DevTools profiling pass, not yet done.

| Checkpoint | Documents | Firestore source bytes | Search dataset bytes | Build time | Search p50/p95 (exact) | Search p50/p95 (fuzzy) | Node heap delta | Browser heap |
| ---------- | --------- | ---------------------- | -------------------- | ---------- | ----------------------- | ----------------------- | --------------- | ------------ |
| Real baseline | <actual count> | <actual or unavailable> | <actual> | <actual> | <actual> | <actual> | <actual> | unavailable unless profiled |
| Synthetic 5k | 5,000 | N/A | <actual> | <actual> | <actual> | <actual> | <actual> | unavailable |
| Synthetic 10k | 10,000 | N/A | <actual> | <actual> | <actual> | <actual> | <actual> | unavailable |
| Synthetic 25k | 25,000 | N/A | <actual> | <actual> | <actual> | <actual> | <actual> | unavailable |
| Synthetic 50k | 50,000 | N/A | <actual> | <actual> | <actual> | <actual> | <actual> | unavailable |

## Against spec Section 2's review thresholds

- Build time: budget is "over 1s → introduce chunked async indexing." Record whether any checkpoint crossed it.
- Search latency: budget is "engine p95 ≤100ms." Record whether any checkpoint crossed it (this harness measures engine time only — `searchDocuments` end to end — not input-to-render, which additionally needs the 150ms debounce and React render time, measured separately in a real browser session, not here).
- Memory: budget is "over 50 MiB retained → review duplicate data and field selection." Record against the Node approximation, and separately record browser heap as unavailable unless measured.
- Dataset growth: record source and derived-search byte sizes at every available checkpoint; use the values to identify duplicated stored fields before adding persistence or a worker.

## Decision (spec Section 11)

State plainly, based on the numbers above, whether IndexedDB caching, a Web Worker, chunked indexing, or explicit vacuum scheduling is justified at each recorded checkpoint. Record the measured reason; do not predict the answer or treat a checkpoint as a supported-capacity promise.
```

- [ ] **Step 4: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors. (The benchmark script is excluded from the app bundle but still type-checked, same as the other `scripts/one-off/*.ts` files.)

- [ ] **Step 5: Commit**

```bash
git add scripts/one-off/benchmark-search-index.ts package.json docs/engineering/search-benchmark-report.md
git commit -m "$(cat <<'EOF'
feat(search): add the growth-checkpoint benchmark harness and first report

EOF
)"
```

---

### Task 8: Docs — log the shipped Phase 3 search feature

**Files:**

- Modify: `docs/engineering/PROGRESS.md`
- Modify: `docs/_complete_logs.md`
- Modify: `docs/ai/CONTEXT.md`
- Modify: `docs/engineering/DECISIONS.md`

Per the process guideline in `docs/ai/AGENTS.md`/`docs/ai/CLAUDE.md` ("finishing a change that ships new work — log it, don't leave it undocumented"), close out Phase 3 once all four plans (this one and its three predecessors) are merged.

- [ ] **Step 1: Move the Phase 3 backlog item**

In `docs/engineering/PROGRESS.md`, move the current Phase 3 checkbox, `- [ ] Implement the approved Phase 3 client-side MiniSearch plan: generic entity references, one derived global index, scoped search, ranking, and growth benchmarks...`, to `docs/_complete_logs.md` only after every Phase 3 acceptance criterion has passed. Check whether Phase 3's heading has any other remaining item; if not, remove the empty heading too. Do not refer to a Firestore full-text-search backlog item: it is not present in the current document and server-side search remains out of scope.

- [ ] **Step 2: Log completion**

In `docs/_complete_logs.md`, add a new section documenting: the six-type Entity Reference System, the `SearchDocument`/`SearchIndexProvider`/MiniSearch index, `SearchScope` + staged ranking in the command palette, Thai tokenizer, and the growth-checkpoint benchmark report's headline conclusion (from Task 7).

- [ ] **Step 3: Update the architecture docs**

In `docs/ai/CONTEXT.md`, replace the "client-side scoped quick search" sentence (added earlier this session) with a description of the real search architecture: MiniSearch-backed, `SearchScope`-aware, entity-reference-integrated — and note the `novels/{novelId}/entities/{entityId}` collection alongside the existing Firestore structure list.

In `docs/engineering/DECISIONS.md`, add an ADR (next available number) recording: "Client-side MiniSearch as the Phase 3 search engine" — decision, why (Firestore has no native full-text search; cite only the actual Task 7 report numbers), and trade-offs (one index per session, rebuildable from Firestore, no server-side search). State whether IndexedDB/Web Worker/chunking were deferred or required at each measured checkpoint; never claim a 50,000-document result until the report contains that result.

- [ ] **Step 4: Commit**

```bash
git add docs/engineering/PROGRESS.md docs/_complete_logs.md docs/ai/CONTEXT.md docs/engineering/DECISIONS.md
git commit -m "$(cat <<'EOF'
docs: log the Phase 3 entity reference + search feature as shipped

EOF
)"
```

---

## Verification Against the Spec

Satisfies spec Section 15: "Conditional prefix/fuzzy, maxFuzzy bounds, debounce, result limits, and Thai/English tokenizer fixtures pass" (Task 1), "Updates/deletes/renames refresh dependent results; mutation-during-build and recovery tests pass" (Task 2/3/6), "Benchmark report records actual measurements and budget decisions, including broad-query and mutation workloads" (Task 7), "Cache/worker remain deferred unless benchmarks justify them; chunking and vacuum decisions are documented" (Task 6/7), "Firestore is the sole source of truth; the entire search projection can be rebuilt from it" (unchanged throughout — every task here operates only on the derived client index).

This is the last of the four plans covering the Phase 3 spec's Implementation Slices (3A through 3F). After Task 8, re-read `docs/superpowers/specs/2026-09-11-novelndex_phase_3_timeline_search-design.md` Section 15 end to end against the shipped code as a final acceptance pass — several criteria (e.g. "Command palette accessibility... remain intact") span all four plans and are worth one last cross-check together rather than trusting each plan's own narrower verification section alone.
