# Phase 3D+3E: SearchScope + Ranking + Command Palette Implementation Plan

**Goal:** Add first-class `SearchScope` (global → novel → volume → chapter) with route-derived defaults and query-preserving widening; a staged exact/prefix/fuzzy ranking engine with explicit match-tier and field-tier priority; and wire both into the existing command palette, replacing its ad-hoc per-mount Firestore fetch with the shared `SearchIndexProvider` from the prior plan.

**Architecture:** `libs/search/scope.ts` derives a `SearchScope` from the current pathname and compiles it into a plain predicate over `SearchDocument` fields — no separate index or query, just a filter applied inside every MiniSearch stage. `libs/search/rank.ts` runs up to three MiniSearch queries per keystroke (exact, then prefix, then fuzzy — each stage only runs if the previous one didn't fill the result limit), merges them keeping the strongest tier per document, and sorts by match tier → field tier → score → stable ID. `components/commands/CommandPalette.tsx` is rewritten to call this against `useSearchIndex()`'s index/documents instead of fetching `getAllCharacters`/`getChaptersFlat`/`getEvents`/`getNovels` itself. On a chapter page it shows the scoped saved-data results **alongside** the existing live-draft results; the latter remains necessary because the index cannot see unsaved textarea content.

**Tech Stack:** Next.js 16 / React 19, MiniSearch `^7.2.0`.

**Spec:** `docs/superpowers/specs/2026-09-11-novelndex_phase_3_timeline_search-design.md` — Sections 7 (First-class SearchScope), 8 (Ranking and Query Strategy), 12 (Search UI and Routing), and Implementation Slices 3D/3E.

**Depends on:** `docs/superpowers/plans/2026-09-11-phase3c-search-document-provider.md` — consumes `SearchDocument`, `useSearchIndex()`, `buildIndex()` exactly as that plan defines them. Do not start until it is merged.

**Implementation status (2026-09-11):** Tasks 1–5 are implemented locally: route-derived scopes and widening, staged ranking with field boosts and trailing-space prefix protection, IME-safe debounce, the shared-index command palette, and note-route pagination/scrolling. Browser and Firestore-emulator integration verification remains pending a running emulator.

## Global Constraints

- Scope is compiled to a predicate and passed to **every** MiniSearch query stage via its `filter` option — never "take global top-N then filter in the UI" (spec Section 7).
- Ranking order is fixed: **match tier** (exact > prefix > fuzzy) first, **field tier** (name/title/author > referenceNames > aliases > tags > content/description) second, MiniSearch relevance score third, document ID (string comparison) last for deterministic ties (spec Section 8).
- Prefix expansion only on the final, still-being-typed term (≥2 normalized characters); fuzzy only for terms ≥5 normalized characters, distance ratio `0.2`, `maxFuzzy: 1`. Both are project decisions this plan hard-codes as named constants, not library defaults.
- Every MiniSearch stage uses the same field boost map: `name`/`title`/`author` 10, `referenceNames` 6, `aliases` 4, `tags` 2, and `content`/`description` 1. Explicit field-tier ordering still decides ties across those categories.
- Debounce input by 150 ms; suppress queries fired mid-IME-composition; ignore a stale response if a newer query/scope superseded it before it resolved.
- Empty input shows the command palette's existing default navigation commands, not a wildcard corpus search.
- The existing chapter-page "search the currently open draft" feature (`CHAPTER_SEARCH_SOURCE_EVENT`/`ChapterSearchSource`/`focusMatch`) is preserved exactly as-is, but does not replace indexed search. On a chapter page, show draft matches first under a distinct label and then saved-data results for the current chapter scope; scope widening must work there just as it does on every other page.
- No component test harness exists in this repo (no RTL/jsdom) — `libs/search/scope.ts` and `libs/search/rank.ts` are pure/hook-free and get full Vitest coverage; `CommandPalette.tsx` changes are verified by `corepack pnpm build && corepack pnpm lint` plus manual browser checks.
- Run `corepack pnpm build && corepack pnpm lint` after each task.

---

### Task 1: `SearchScope` — type, route defaults, widening, and the membership predicate

**Files:**

- Create: `libs/search/scope.ts`
- Create: `libs/search/scope.test.ts`

**Interfaces:**

- Consumes: `SearchDocument` (`@/libs/search/types`).
- Produces: `SearchScope`, `scopeFromPathname(pathname): SearchScope`, `widerScopes(scope): SearchScope[]`, `matchesScope(doc, scope): boolean` — consumed by Task 2 (ranking) and Task 4 (command palette).

- [ ] **Step 1: Write the failing tests**

Create `libs/search/scope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  matchesScope,
  scopeFromPathname,
  widerScopes,
  type SearchScope,
} from "./scope";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "d",
    type: "novel",
    novelId: "novel-1",
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

describe("scopeFromPathname", () => {
  it("resolves chapter scope", () => {
    expect(scopeFromPathname("/novels/n1/volumes/v1/chapters/c1")).toEqual({
      kind: "chapter",
      novelId: "n1",
      volumeId: "v1",
      chapterId: "c1",
    });
  });
  it("resolves volume scope", () => {
    expect(scopeFromPathname("/novels/n1/volumes/v1")).toEqual({
      kind: "volume",
      novelId: "n1",
      volumeId: "v1",
    });
  });
  it("resolves novel scope", () => {
    expect(scopeFromPathname("/novels/n1")).toEqual({
      kind: "novel",
      novelId: "n1",
    });
  });
  it("resolves novel scope for nested non-volume novel routes (e.g. characters, entities, timeline)", () => {
    expect(scopeFromPathname("/novels/n1/characters/char-1")).toEqual({
      kind: "novel",
      novelId: "n1",
    });
    expect(scopeFromPathname("/novels/n1/timeline")).toEqual({
      kind: "novel",
      novelId: "n1",
    });
  });
  it("resolves global scope for the home/library page", () => {
    expect(scopeFromPathname("/novels")).toEqual({ kind: "global" });
    expect(scopeFromPathname("/")).toEqual({ kind: "global" });
  });
});

describe("widerScopes", () => {
  it("offers volume -> novel -> global from a chapter scope", () => {
    const scope: SearchScope = {
      kind: "chapter",
      novelId: "n1",
      volumeId: "v1",
      chapterId: "c1",
    };
    expect(widerScopes(scope)).toEqual([
      { kind: "volume", novelId: "n1", volumeId: "v1" },
      { kind: "novel", novelId: "n1" },
      { kind: "global" },
    ]);
  });
  it("offers novel -> global from a volume scope", () => {
    expect(
      widerScopes({ kind: "volume", novelId: "n1", volumeId: "v1" }),
    ).toEqual([{ kind: "novel", novelId: "n1" }, { kind: "global" }]);
  });
  it("offers global from a novel scope", () => {
    expect(widerScopes({ kind: "novel", novelId: "n1" })).toEqual([
      { kind: "global" },
    ]);
  });
  it("offers nothing from global scope", () => {
    expect(widerScopes({ kind: "global" })).toEqual([]);
  });
});

describe("matchesScope", () => {
  const novelDoc = doc({ id: "novel:n1", type: "novel", novelId: "n1" });
  const otherNovelDoc = doc({ id: "novel:n2", type: "novel", novelId: "n2" });
  const chapterDoc = doc({
    id: "chapter:n1:v1:c1",
    type: "chapter",
    novelId: "n1",
    volumeId: "v1",
    chapterId: "c1",
  });
  const noteDoc = doc({
    id: "note:n1:v1:c1:note1",
    type: "note",
    novelId: "n1",
    volumeId: "v1",
    chapterId: "c1",
  });
  const entityDoc = doc({
    id: "entity:n1:location:l1",
    type: "entity",
    novelId: "n1",
  }); // no volumeId/chapterId — a standalone entity.
  const otherChapterDoc = doc({
    id: "chapter:n1:v1:c2",
    type: "chapter",
    novelId: "n1",
    volumeId: "v1",
    chapterId: "c2",
  });

  it("global scope matches everything", () => {
    expect(matchesScope(novelDoc, { kind: "global" })).toBe(true);
    expect(matchesScope(otherNovelDoc, { kind: "global" })).toBe(true);
  });

  it("novel scope excludes other novels but includes standalone entities of this novel", () => {
    expect(matchesScope(novelDoc, { kind: "novel", novelId: "n1" })).toBe(true);
    expect(matchesScope(otherNovelDoc, { kind: "novel", novelId: "n1" })).toBe(
      false,
    );
    expect(matchesScope(entityDoc, { kind: "novel", novelId: "n1" })).toBe(
      true,
    );
  });

  it("volume scope excludes standalone entities and documents with no volumeId", () => {
    expect(
      matchesScope(chapterDoc, {
        kind: "volume",
        novelId: "n1",
        volumeId: "v1",
      }),
    ).toBe(true);
    expect(
      matchesScope(entityDoc, {
        kind: "volume",
        novelId: "n1",
        volumeId: "v1",
      }),
    ).toBe(false);
    expect(
      matchesScope(novelDoc, { kind: "volume", novelId: "n1", volumeId: "v1" }),
    ).toBe(false);
  });

  it("chapter scope includes the chapter and its notes, excludes sibling chapters and ancestors", () => {
    const scope: SearchScope = {
      kind: "chapter",
      novelId: "n1",
      volumeId: "v1",
      chapterId: "c1",
    };
    expect(matchesScope(chapterDoc, scope)).toBe(true);
    expect(matchesScope(noteDoc, scope)).toBe(true);
    expect(matchesScope(otherChapterDoc, scope)).toBe(false);
    expect(matchesScope(novelDoc, scope)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/scope.test.ts`
Expected: FAIL — `Cannot find module './scope'`.

- [ ] **Step 3: Implement**

Create `libs/search/scope.ts`:

```ts
import type { SearchDocument } from "./types";

export type SearchScope =
  | { kind: "global" }
  | { kind: "novel"; novelId: string }
  | { kind: "volume"; novelId: string; volumeId: string }
  | { kind: "chapter"; novelId: string; volumeId: string; chapterId: string };

export function scopeFromPathname(pathname: string): SearchScope {
  const chapter = pathname.match(
    /^\/novels\/([^/]+)\/volumes\/([^/]+)\/chapters\/([^/]+)/,
  );
  if (chapter)
    return {
      kind: "chapter",
      novelId: chapter[1],
      volumeId: chapter[2],
      chapterId: chapter[3],
    };

  const volume = pathname.match(/^\/novels\/([^/]+)\/volumes\/([^/]+)/);
  if (volume)
    return { kind: "volume", novelId: volume[1], volumeId: volume[2] };

  const novel = pathname.match(/^\/novels\/([^/]+)\/?/);
  if (novel && novel[1]) return { kind: "novel", novelId: novel[1] };

  return { kind: "global" };
}

export function widerScopes(scope: SearchScope): SearchScope[] {
  switch (scope.kind) {
    case "chapter":
      return [
        { kind: "volume", novelId: scope.novelId, volumeId: scope.volumeId },
        { kind: "novel", novelId: scope.novelId },
        { kind: "global" },
      ];
    case "volume":
      return [{ kind: "novel", novelId: scope.novelId }, { kind: "global" }];
    case "novel":
      return [{ kind: "global" }];
    case "global":
      return [];
  }
}

// Membership follows document placement (spec Section 7): a document without a
// volumeId/chapterId (e.g. a standalone entity) naturally fails volume/chapter
// scope's field-equality checks below — no special-casing per document type needed.
export function matchesScope(doc: SearchDocument, scope: SearchScope): boolean {
  if (scope.kind === "global") return true;
  if (doc.novelId !== scope.novelId) return false;
  if (scope.kind === "novel") return true;
  if (doc.volumeId !== scope.volumeId) return false;
  if (scope.kind === "volume") return true;
  return doc.chapterId === scope.chapterId;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/search/scope.ts libs/search/scope.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add first-class SearchScope with route defaults and widening

EOF
)"
```

---

### Task 2: Staged exact/prefix/fuzzy ranking engine

**Files:**

- Create: `libs/search/rank.ts`
- Create: `libs/search/rank.test.ts`

**Interfaces:**

- Consumes: `buildIndex` (`@/libs/search/buildIndex`), `matchesScope` (Task 1), `SearchDocument` (`@/libs/search/types`).
- Produces: `searchDocuments(index, documents, query, scope, options?): SearchDocument[]` — consumed by Task 4 (command palette) and reusable by any future consumer needing scoped ranked search.

This is the only task in this plan tested against a **real** `MiniSearch` instance (via `buildIndex` from the prior plan) rather than a mock — ranking behavior is inseparable from MiniSearch's own tokenization and scoring, so faking it would test nothing real.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/rank.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIndex } from "./buildIndex";
import { searchDocuments } from "./rank";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "d",
    type: "novel",
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

function indexFor(docs: SearchDocument[]) {
  return {
    index: buildIndex(docs),
    documents: new Map(docs.map((d) => [d.id, d])),
  };
}

describe("searchDocuments", () => {
  it("ranks an exact title match above a fuzzy content match for the same query", () => {
    const exact = doc({ id: "exact", type: "chapter", title: "Rimuru" });
    const fuzzyOnly = doc({
      id: "fuzzy",
      type: "note",
      content: "Rimurru appeared briefly.",
    }); // misspelled, only fuzzy-reachable
    const { index, documents } = indexFor([exact, fuzzyOnly]);

    const results = searchDocuments(index, documents, "Rimuru", {
      kind: "global",
    });
    expect(results[0].id).toBe("exact");
  });

  it("within the same match tier, ranks name/title above content", () => {
    const titleMatch = doc({
      id: "title",
      type: "chapter",
      title: "Predator Skill",
    });
    const contentMatch = doc({
      id: "content",
      type: "note",
      content: "He unlocked the Predator Skill.",
    });
    const { index, documents } = indexFor([titleMatch, contentMatch]);

    const results = searchDocuments(index, documents, "Predator", {
      kind: "global",
    });
    expect(results[0].id).toBe("title");
  });

  it("within the same match tier, ranks referenceNames above aliases, and aliases above tags", () => {
    const byReference = doc({
      id: "ref",
      type: "note",
      content: "x",
      referenceNames: ["Zephyr"],
    });
    const byAlias = doc({ id: "alias", type: "entity", aliases: ["Zephyr"] });
    const byTag = doc({ id: "tag", type: "chapter", tags: ["Zephyr"] });
    const { index, documents } = indexFor([byTag, byAlias, byReference]); // insertion order deliberately scrambled

    const results = searchDocuments(index, documents, "Zephyr", {
      kind: "global",
    });
    expect(results.map((r) => r.id)).toEqual(["ref", "alias", "tag"]);
  });

  it("applies scope before ranking — an out-of-scope higher-relevance document never appears", () => {
    const inScope = doc({ id: "in", novelId: "n1", title: "Rimuru" });
    const outOfScope = doc({
      id: "out",
      novelId: "n2",
      title: "Rimuru Rimuru Rimuru",
    }); // would score higher on relevance alone
    const { index, documents } = indexFor([inScope, outOfScope]);

    const results = searchDocuments(index, documents, "Rimuru", {
      kind: "novel",
      novelId: "n1",
    });
    expect(results.map((r) => r.id)).toEqual(["in"]);
  });

  it("only falls back to prefix when the exact stage under-fills the scoped result set", () => {
    const exactOnly = doc({ id: "exact", title: "Cat" });
    const prefixOnly = doc({ id: "prefix", title: "Category" }); // only prefix-reachable for query "Cat"
    const { index, documents } = indexFor([exactOnly, prefixOnly]);

    const results = searchDocuments(
      index,
      documents,
      "Cat",
      { kind: "global" },
      { limit: 30 },
    );
    expect(results.map((r) => r.id)).toContain("prefix"); // fallback ran because exact alone didn't fill 30
    expect(results[0].id).toBe("exact"); // but exact still ranks first
  });

  it("does not prefix-expand a completed final term", () => {
    const exactOnly = doc({ id: "exact", title: "Cat" });
    const prefixOnly = doc({ id: "prefix", title: "Category" });
    const { index, documents } = indexFor([exactOnly, prefixOnly]);
    const results = searchDocuments(index, documents, "Cat ", {
      kind: "global",
    });
    expect(results.map((result) => result.id)).toEqual(["exact"]);
  });

  it("does not fuzzy-match a short term (below the 5-character minimum)", () => {
    const doc1 = doc({ id: "d1", title: "Cap" });
    const typo = doc({ id: "d2", title: "Cat" }); // 1 edit from "Cap" but "Cap" is only 3 chars — fuzzy must not kick in
    const { index, documents } = indexFor([doc1, typo]);

    const results = searchDocuments(index, documents, "Cap", {
      kind: "global",
    });
    expect(results.map((r) => r.id)).toEqual(["d1"]); // exact match only — no fuzzy "Cat"
  });

  it("fuzzy-matches a longer misspelled term (>= 5 characters)", () => {
    const correct = doc({ id: "correct", title: "Predator" });
    const { index, documents } = indexFor([correct]);

    const results = searchDocuments(index, documents, "Predater", {
      kind: "global",
    }); // 1-character typo, 8 chars long
    expect(results.map((r) => r.id)).toEqual(["correct"]);
  });

  it("deduplicates a document that matches multiple stages, keeping only its strongest tier", () => {
    const doc1 = doc({ id: "d1", title: "Test" }); // matches the exact stage
    const { index, documents } = indexFor([doc1]);

    const results = searchDocuments(index, documents, "Test", {
      kind: "global",
    });
    expect(results).toHaveLength(1);
  });

  it("breaks a tie between equally-ranked documents by stable document ID", () => {
    const a = doc({ id: "b-doc", title: "Tie" });
    const b = doc({ id: "a-doc", title: "Tie" });
    const { index, documents } = indexFor([a, b]);

    const results = searchDocuments(index, documents, "Tie", {
      kind: "global",
    });
    expect(results.map((r) => r.id)).toEqual(["a-doc", "b-doc"]);
  });

  it("respects the result limit", () => {
    const docs = Array.from({ length: 40 }, (_, i) =>
      doc({ id: `d${i}`, title: "Common" }),
    );
    const { index, documents } = indexFor(docs);

    const results = searchDocuments(
      index,
      documents,
      "Common",
      { kind: "global" },
      { limit: 10 },
    );
    expect(results).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/rank.test.ts`
Expected: FAIL — `Cannot find module './rank'`.

- [ ] **Step 3: Implement**

Create `libs/search/rank.ts`:

```ts
import type MiniSearch from "minisearch";
import type { SearchResult as MiniSearchResult } from "minisearch";
import { matchesScope, type SearchScope } from "./scope";
import type { SearchDocument } from "./types";

const DEFAULT_LIMIT = 30;
const PREFIX_MIN_LENGTH = 2;
const FUZZY_MIN_LENGTH = 5;
const FUZZY_DISTANCE_RATIO = 0.2;
const MAX_FUZZY = 1;
const FIELD_BOOSTS = {
  name: 10, title: 10, author: 10, referenceNames: 6, aliases: 4,
  tags: 2, content: 1, description: 1,
};

type MatchTier = 0 | 1 | 2; // 0 = exact, 1 = prefix, 2 = fuzzy — lower is stronger.
type FieldTier = 0 | 1 | 2 | 3 | 4; // 0 = name/title/author, 1 = referenceNames, 2 = aliases, 3 = tags, 4 = content/description.

const FIELD_TIER: Record<string, FieldTier> = {
  name: 0,
  title: 0,
  author: 0,
  referenceNames: 1,
  aliases: 2,
  tags: 3,
  content: 4,
  description: 4,
};

interface Ranked {
  id: string;
  matchTier: MatchTier;
  fieldTier: FieldTier;
  score: number;
}

function strongestFieldTier(match: Record<string, string[]>): FieldTier {
  const tiers = Object.values(match)
    .flat()
    .map((field) => FIELD_TIER[field] ?? 4);
  return (tiers.length ? Math.min(...tiers) : 4) as FieldTier;
}

function isStronger(a: Ranked, b: Ranked): boolean {
  if (a.matchTier !== b.matchTier) return a.matchTier < b.matchTier;
  if (a.fieldTier !== b.fieldTier) return a.fieldTier < b.fieldTier;
  return a.score > b.score;
}

export interface SearchOptions {
  limit?: number;
}

export function searchDocuments(
  index: MiniSearch<SearchDocument>,
  documents: Map<string, SearchDocument>,
  query: string,
  scope: SearchScope,
  options: SearchOptions = {},
): SearchDocument[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!query.trim()) return [];
  // Tokenization loses trailing whitespace, so retain whether the final term is complete.
  const finalTermIsComplete = /\s$/u.test(query);

  const filter = (result: { id: unknown }) => {
    const doc = documents.get(result.id as string);
    return doc ? matchesScope(doc, scope) : false;
  };

  const collected = new Map<string, Ranked>();
  function collect(results: MiniSearchResult[], matchTier: MatchTier) {
    results.forEach((result) => {
      const candidate: Ranked = {
        id: String(result.id),
        matchTier,
        fieldTier: strongestFieldTier(result.match),
        score: result.score,
      };
      const existing = collected.get(candidate.id);
      if (!existing || isStronger(candidate, existing))
        collected.set(candidate.id, candidate);
    });
  }

  const exact = index.search(query, {
    prefix: false,
    fuzzy: false,
    boost: FIELD_BOOSTS,
    combineWith: "AND",
    filter,
  });
  collect(exact, 0);

  if (collected.size < limit) {
    const prefix = index.search(query, {
      prefix: (term, i, terms) =>
        !finalTermIsComplete && i === terms.length - 1 && term.length >= PREFIX_MIN_LENGTH,
      fuzzy: false,
      boost: FIELD_BOOSTS,
      combineWith: "AND",
      filter,
    });
    collect(prefix, 1);
  }

  if (collected.size < limit) {
    const fuzzy = index.search(query, {
      fuzzy: (term) =>
        term.length >= FUZZY_MIN_LENGTH ? FUZZY_DISTANCE_RATIO : false,
      maxFuzzy: MAX_FUZZY,
      prefix: false,
      boost: FIELD_BOOSTS,
      combineWith: "AND",
      filter,
    });
    collect(fuzzy, 2);
  }

  const ranked = [...collected.values()].sort(
    (a, b) =>
      a.matchTier - b.matchTier ||
      a.fieldTier - b.fieldTier ||
      b.score - a.score ||
      a.id.localeCompare(b.id),
  );

  return ranked
    .slice(0, limit)
    .map((r) => documents.get(r.id))
    .filter((d): d is SearchDocument => Boolean(d));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/rank.test.ts`
Expected: PASS. If the "does not fuzzy-match a short term" or "fuzzy-matches a longer misspelled term" cases fail, check MiniSearch's actual fuzzy-distance semantics against the pinned `7.2.0` version (the spec explicitly flags this: "Pin the chosen version and verify these contracts during implementation") and adjust `FUZZY_DISTANCE_RATIO`/`FUZZY_MIN_LENGTH` — these are named constants precisely so this is a one-line tuning change, not a rewrite.

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/search/rank.ts libs/search/rank.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add staged exact/prefix/fuzzy ranking with field-tier priority

EOF
)"
```

---

### Task 3: Debounce and IME-composition guard

**Files:**

- Create: `libs/search/queryDebouncer.ts`
- Create: `libs/search/queryDebouncer.test.ts`

**Interfaces:**

- Produces: `createQueryDebouncer(onQuery: (value: string) => void, delayMs?: number)` returning `{ handleInput(value: string): void; handleCompositionStart(): void; handleCompositionEnd(value: string): void; cancel(): void }` — consumed by Task 4 (command palette).

Implemented as a plain factory function (not a React hook) so it is testable with Vitest's fake timers alone — this repo has no React hook-testing infrastructure (no RTL), and a hook wrapping nothing but `setTimeout`/a boolean flag doesn't need one.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/queryDebouncer.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryDebouncer } from "./queryDebouncer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createQueryDebouncer", () => {
  it("fires onQuery after the debounce delay", () => {
    const onQuery = vi.fn();
    const debouncer = createQueryDebouncer(onQuery, 150);
    debouncer.handleInput("rim");
    expect(onQuery).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(onQuery).toHaveBeenCalledWith("rim");
  });

  it("resets the timer on rapid successive input", () => {
    const onQuery = vi.fn();
    const debouncer = createQueryDebouncer(onQuery, 150);
    debouncer.handleInput("r");
    vi.advanceTimersByTime(100);
    debouncer.handleInput("ri");
    vi.advanceTimersByTime(100);
    expect(onQuery).not.toHaveBeenCalled(); // 100ms + 100ms < 150ms restarted twice
    vi.advanceTimersByTime(50);
    expect(onQuery).toHaveBeenCalledTimes(1);
    expect(onQuery).toHaveBeenCalledWith("ri");
  });

  it("suppresses input fired between compositionstart and compositionend", () => {
    const onQuery = vi.fn();
    const debouncer = createQueryDebouncer(onQuery, 150);
    debouncer.handleCompositionStart();
    debouncer.handleInput("partial-ime-state");
    vi.advanceTimersByTime(150);
    expect(onQuery).not.toHaveBeenCalled();

    debouncer.handleCompositionEnd("final-composed-text");
    vi.advanceTimersByTime(150);
    expect(onQuery).toHaveBeenCalledWith("final-composed-text");
  });

  it("cancel() prevents a pending call from firing", () => {
    const onQuery = vi.fn();
    const debouncer = createQueryDebouncer(onQuery, 150);
    debouncer.handleInput("x");
    debouncer.cancel();
    vi.advanceTimersByTime(150);
    expect(onQuery).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/queryDebouncer.test.ts`
Expected: FAIL — `Cannot find module './queryDebouncer'`.

- [ ] **Step 3: Implement**

Create `libs/search/queryDebouncer.ts`:

```ts
export interface QueryDebouncer {
  handleInput(value: string): void;
  handleCompositionStart(): void;
  handleCompositionEnd(value: string): void;
  cancel(): void;
}

export function createQueryDebouncer(
  onQuery: (value: string) => void,
  delayMs = 150,
): QueryDebouncer {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let composing = false;

  function schedule(value: string) {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      onQuery(value);
    }, delayMs);
  }

  return {
    handleInput(value) {
      if (composing) return; // suppress intermediate IME composition queries (spec Section 8).
      schedule(value);
    },
    handleCompositionStart() {
      composing = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    handleCompositionEnd(value) {
      composing = false;
      schedule(value);
    },
    cancel() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/queryDebouncer.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/search/queryDebouncer.ts libs/search/queryDebouncer.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add a debounce/IME-composition guard for query input

EOF
)"
```

---

### Task 4: Wire scope + ranking + debouncing into the command palette

**Files:**

- Modify: `components/commands/CommandPalette.tsx`
- Modify: `locales/en.ts`, `locales/th.ts`

**Interfaces:**

- Consumes: `useSearchIndex()` (prior plan), `scopeFromPathname`/`widerScopes`/`matchesScope` (Task 1), `searchDocuments` (Task 2), `createQueryDebouncer` (Task 3).

This replaces the `useEffect` at `components/commands/CommandPalette.tsx:69-86` (the one that calls `getNovels`/`getAllCharacters`/`getChaptersFlat`/`getEvents` on every non-chapter-page mount) with the shared index. Keep the chapter-page draft source and `localCommands`, then merge those live-draft results with the scoped index results instead of choosing one branch or the other.

- [ ] **Step 1: Replace the entity-fetching effect with scoped index search**

Remove the `entityCommands`/`useEffect` block (lines 62, 69-86) and the now-unused imports `getAllCharacters, getChaptersFlat, getEvents, getNovels` from `@/libs/api` (line 6). Add:

```tsx
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import {
  scopeFromPathname,
  widerScopes,
  type SearchScope,
} from "@/libs/search/scope";
import { searchDocuments } from "@/libs/search/rank";
import { createQueryDebouncer } from "@/libs/search/queryDebouncer";
import type { SearchDocument } from "@/libs/search/types";
import type { TranslationKey } from "@/components/i18n/I18nProvider";
```

Add scope and result state alongside the existing `open`/`query`/`chapterSource` state:

```tsx
const { index, documents, status: indexStatus } = useSearchIndex();
const [scopeOverride, setScopeOverride] = useState<SearchScope | null>(null);
const [debouncedQuery, setDebouncedQuery] = useState("");
const [results, setResults] = useState<SearchDocument[]>([]);
const debouncerRef = useRef(createQueryDebouncer(setDebouncedQuery));

const routeScope = useMemo(() => scopeFromPathname(pathname), [pathname]);
const scope = scopeOverride ?? routeScope;
const widenOptions = useMemo(() => widerScopes(scope), [scope]);
```

Reset `scopeOverride` and `debouncedQuery` whenever the palette (re)opens from a new page, and cancel any timer left by its preceding session — inside `openPalette()` (line 102):

```tsx
function openPalette() {
  debouncerRef.current.cancel();
  setQuery("");
  setDebouncedQuery("");
  setScopeOverride(null);
  setChapterSource(chapterPage ? requestChapterSource() : null);
  setOpen(true);
}
```

Add an unmount cleanup so a pending timer cannot update state after the palette component is removed:

```tsx
useEffect(() => () => debouncerRef.current.cancel(), []);
```

Feed keystrokes to the debouncer instead of computing indexed matches directly from `query` on any page — change the input's `onChange` (line 109) so it updates `query` (still used for the input's controlled value, immediate draft search, and Enter-to-select-first-result) and also calls `debouncerRef.current.handleInput(event.target.value)`, plus wire `onCompositionStart`/`onCompositionEnd`:

```tsx
<input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); debouncerRef.current.handleInput(event.target.value) }} onCompositionStart={() => debouncerRef.current.handleCompositionStart()} onCompositionEnd={(event) => debouncerRef.current.handleCompositionEnd(event.currentTarget.value)} onKeyDown={...} .../>
```

Run the actual scoped/ranked search whenever the debounced query, scope, or index changes, guarding against a stale response (spec: "ignore stale query/scope responses") with the same "latest request wins" pattern already used in `SearchIndexProvider`'s `buildIdRef`:

```tsx
const searchRequestRef = useRef(0);
useEffect(() => {
  if (!debouncedQuery.trim() || !index) {
    setResults([]);
    return;
  }
  const requestId = ++searchRequestRef.current;
  const next = searchDocuments(index, documents, debouncedQuery, scope);
  if (searchRequestRef.current === requestId) setResults(next);
}, [debouncedQuery, documents, index, scope]);
```

(Because `searchDocuments` is synchronous, the `requestId` guard here is defensive rather than strictly necessary today — it becomes load-bearing the moment any future change makes the search asynchronous, e.g. a Web Worker per the deferred "Benchmark-gated Cache and Worker" section of the spec — keep it.)

- [ ] **Step 2: Merge scoped results into `matches` and render type/context**

Update the `matches` memo (line 95-100) to use indexed `results` everywhere. On a chapter page, retain the existing live-draft matches first, then append indexed results; render a small "Current draft" label above the former and a "Saved content" label above the latter. This preserves draft navigation while delivering the required Current Chapter default scope and widening controls:

```tsx
const matches = useMemo(() => {
  if (chapterPage) return query.trim()
    ? [...localCommands, ...results.map((doc) => resultToCommand(doc, documents))]
    : [];
  if (!query.trim()) return navigationCommands;
  return results.map((doc) => resultToCommand(doc, documents));
}, [
  chapterPage,
  documents,
  localCommands,
  navigationCommands,
  query,
  resultToCommand,
  results,
]);
```

Define `resultToCommand` inside `CommandPalette` as a `useCallback`, so it closes over the correctly typed `t` returned by `useI18n`; do not widen it to `(key: string) => string`. For dynamic translation keys, cast the constructed key to `TranslationKey` (already exported by `I18nProvider`) and keep translation values as `string | number`. It maps a `SearchDocument` to the existing `Command` shape and resolves volume/chapter context from the same `documents` map:

```tsx
const resultToCommand = useCallback((
  doc: SearchDocument,
  documents: Map<string, SearchDocument>,
): Command => {
  const parentChapter =
    doc.chapterId && doc.volumeId
      ? documents.get(`chapter:${doc.novelId}:${doc.volumeId}:${doc.chapterId}`)
      : undefined;
  const parentVolume = doc.volumeId
    ? documents.get(`volume:${doc.novelId}:${doc.volumeId}`)
    : undefined;
  const context = [
    parentVolume?.name
      ? `${t("command.volumeLabel")} ${parentVolume.name}`
      : null,
    parentChapter?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  const excerpt = (doc.content ?? doc.description ?? "").slice(0, 140);
  const typeLabel =
    doc.type === "entity" && doc.entityType
      ? t(`command.resultType.${doc.entityType}` as TranslationKey)
      : t(`command.resultType.${doc.type}` as TranslationKey);
  return {
    id: doc.id,
    label: doc.title ?? doc.name ?? "",
    hint: [typeLabel, context, excerpt].filter(Boolean).join(" · "),
    href: doc.route,
    keywords: `${doc.title ?? ""} ${doc.name ?? ""} ${doc.content ?? ""} ${doc.description ?? ""} ${doc.tags.join(" ")} ${doc.referenceNames.join(" ")}`,
  };
}, [t]);
```

Add `command.volumeLabel` and one `command.resultType.*` key per `SearchDocumentType`/`EntityType` value (`novel`, `volume`, `chapter`, `note`, `character`, `location`, `skill`, `organization`, `item`, `concept`, `event`) to `locales/en.ts`/`locales/th.ts`.

- [ ] **Step 3: Scope indicator and widening UI**

Add a small row above the query input (inside the existing `<div className="border-b border-stone-200 p-3">` block, before the `<input>`) on every page, including chapter pages:

```tsx
{(
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
      <span>{t(`command.scope.${scope.kind}` as TranslationKey)}</span>
      {widenOptions.map((option) => (
        <button
          key={option.kind}
          type="button"
          onClick={() => setScopeOverride(option)}
          className="rounded-full border border-stone-200 px-2 py-0.5 hover:border-stone-400 hover:text-stone-900">
          {t("command.widenTo", { scope: t(`command.scope.${option.kind}` as TranslationKey) })}
        </button>
      ))}
    </div>
)}
```

Use the normal JSX expression closing `)}` shown above; do not leave the earlier `!chapterPage &&` condition in place.

Add `command.scope.global`, `command.scope.novel`, `command.scope.volume`, `command.scope.chapter`, and `command.widenTo` (`"Widen to {scope}"` / Thai equivalent) to both locale files.

- [ ] **Step 4: Empty/loading states**

When `indexStatus !== 'ready'` and the query is non-empty, including on a chapter page, show index loading/error copy for the saved-data section instead of treating that section as empty. Keep the live-draft empty state independent.

Render separate empty states: the existing `command.noChapterMatches` applies only to an empty live-draft group; the saved-data group uses `command.indexLoading`, `command.indexError`, or `command.noMatches` based on `indexStatus`. Do not hide saved scoped results merely because a draft has no match.

Add `command.indexLoading`/`command.indexError` to both locale files.

- [ ] **Step 5: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running:

1. On the novels list page, open the palette (Ctrl/Cmd+Shift+K), type a query matching a chapter title in some novel — confirm it appears, ranked above a content-only match for the same term.
2. Navigate into a novel, open the palette — confirm the scope indicator shows "Novel" and a "Widen to Global" button appears; click it and confirm results from other novels now appear.
3. Navigate into a chapter, open the palette — confirm the scope indicator begins at "Chapter", widening controls work, and saved chapter results appear beneath the existing "Current draft" matches. Confirm draft `focusMatch` scrolling is unchanged.
4. Type a query, wait less than 150ms, keep typing — confirm no flicker/extra queries fire until you pause (debounce working).
5. Search for something misspelled by one character, at least 5 characters long — confirm it still resolves via the fuzzy fallback.

- [ ] **Step 6: Commit**

```bash
git add components/commands/CommandPalette.tsx locales/en.ts locales/th.ts
git commit -m "$(cat <<'EOF'
feat(search): wire SearchScope + staged ranking into the command palette

Keeps the chapter-page draft search and combines it with scoped saved-data search.

EOF
)"
```

---

### Task 5: Note pagination anchor

**Files:**

- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx`

**Interfaces:**

- Consumes: nothing new — this task closes the loop on `normalizeNote`'s `route: ".../chapters/{chapterId}?note={noteId}"` from the prior plan, and on the existing `ChapterNotesEditor` pagination state.

Spec Section 12: "The chapter page reads `note`, finds its pagination page, renders `id=\"note-:noteId\"`, and scrolls after that page mounts." Today, clicking a note search result would land on the chapter page but never navigate to the right page of the notes list or scroll to it.

- [ ] **Step 1: Thread the `note` search param through**

In `page.tsx`, extend `searchParams` and pass it to `ChapterNotesEditor`:

```tsx
searchParams: Promise<{ find?: string; note?: string }>;
```

```tsx
const { find = "", note = "" } = await searchParams;
```

```tsx
<ChapterNotesEditor
  notes={chapter.notes}
  characters={chapter.characters}
  novelId={id}
  volumeId={volumeId}
  chapterId={chapter.id}
  initialFind={find}
  initialNoteId={note}
/>
```

- [ ] **Step 2: Jump to the right page and scroll**

In `ChapterNotesEditor.tsx`, accept the new prop and add the anchor `id` to each note article:

```tsx
export default function ChapterNotesEditor({ notes: initialNotes, characters, novelId, volumeId, chapterId, initialFind = '', initialNoteId = '' }: { notes: ChapterNote[]; characters: Character[]; novelId: string; volumeId: string; chapterId: string; initialFind?: string; initialNoteId?: string }) {
```

Add an effect that jumps to the note's page once, on mount (placed near the existing `initialFind` effect at line 45):

```tsx
useEffect(() => {
  if (!initialNoteId) return;
  const index = notes.findIndex((note) => note.id === initialNoteId);
  if (index < 0) return;
  setPage(Math.floor(index / NOTES_PER_PAGE) + 1);
}, [initialNoteId, notes]);

useEffect(() => {
  if (!initialNoteId) return;
  if (!visibleNotes.some((note) => note.id === initialNoteId)) return; // wait until the target page's notes are actually rendered
  const frame = window.requestAnimationFrame(() => {
    document
      .getElementById(`note-${initialNoteId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  return () => window.cancelAnimationFrame(frame);
}, [initialNoteId, visibleNotes]);
```

Add the anchor `id` to each note's `<article>` (line 50, inside `visibleNotes.map(...)`):

```tsx
<article key={note.id} id={`note-${note.id}`} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
```

- [ ] **Step 3: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: create a chapter with more than 5 notes (`NOTES_PER_PAGE`), note the ID of one on page 2+ (inspect the Firestore emulator UI or a temporary `console.log`), then visit `.../chapters/{id}?note={thatId}` directly — confirm the page auto-advances to the correct page and scrolls to that note. Then confirm clicking a "note" result in the command palette lands there the same way.

- [ ] **Step 4: Commit**

```bash
git add "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx" "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx"
git commit -m "$(cat <<'EOF'
feat(search): jump to and scroll to a note\'s page from a search result

EOF
)"
```

---

## Verification Against the Spec

Satisfies spec Section 15: "Home/Novel/Volume/Chapter defaults match their scope; widening preserves query text" (Task 1/4), "Many higher-scoring out-of-scope hits cannot hide a valid scoped result or incorrectly suppress fuzzy fallback" (Task 2's scope-before-fallback ordering), "Exact beats prefix beats fuzzy; within each tier, field priority follows Section 8" (Task 2), "Conditional prefix/fuzzy, maxFuzzy bounds, debounce, result limits... pass" (Task 2/3), "Current chapter labels use `formatChapterLabel`" (Task 4's `resultToCommand`, via the prior plan's `normalizeChapter`), "Command palette accessibility and shipped timeline CRUD/filter/order/navigation remain intact" (Task 4's untouched chapter-page branch; existing keyboard nav/Escape/focus-restoration in `CommandPalette.tsx` is unmodified).

Deferred to the incremental-maintenance plan (a separate plan document, covering spec Section 10's later half, Section 11, and the growth-checkpoint benchmarking of Section 2): Thai tokenizer/segmentation validation (spec Section 9), entity/tag rename cascades, delete cascades, vacuum scheduling, and the growth-checkpoint benchmark suite.
