# Phase 3C: SearchDocument Normalization + Provider/Index Lifecycle Implementation Plan

**Goal:** Build the generic `SearchDocument` model, the Firestore-to-search normalizers for all six document types, a lightweight purpose-built loader, and a `SearchIndexProvider` that owns exactly one client-side MiniSearch index for the whole app session — mounted once, built once, kept in sync via incremental `add`/`replace`/`discard` after successful Firestore writes.

**Architecture:** `libs/search/types.ts` defines `SearchDocument`; `libs/search/normalize.ts` converts each domain type (novel/volume/chapter/note/entity/event) into zero or more `SearchDocument`s, resolving reference/alias projections through a live entity map so renames show up without re-authoring content; `libs/search/loader.ts` fetches a purpose-built dataset (not the paginated/aggregate-heavy shapes the UI list pages use); `libs/search/SearchIndexProvider.tsx` is a React context mounted in `app/layout.tsx` that owns the single `MiniSearch<SearchDocument>` instance, the document map, and the entity-dependency map, and exposes `add`/`replace`/`discard` primitives plus loading/error/retry state.

**Tech Stack:** Next.js 16 / React 19, Cloud Firestore, [MiniSearch](https://github.com/lucaong/minisearch) `^7.2.0`.

**Spec:** `docs/superpowers/specs/2026-09-11-novelndex_phase_3_timeline_search-design.md` — Sections 3 (Architecture Decision), 5 (Search Document Model), 6 (Searchable Content and Stable Identity), 9 (MiniSearch Configuration, partial — see Plan 4 for the tokenizer), 10 (Index Ownership, Loading, and Mutations), and Implementation Slice 3C.

**Depends on:** `docs/superpowers/plans/2026-09-11-phase3a-timeline-audit-entity-references.md` — this plan consumes `EntityId`/`EntityType`/`EntityReference` (`libs/entities/types.ts`), `getEntities`/`getEntity` (`libs/firebase/entities.ts`), and `ChapterNote.references` / `NovelEvent.description_references` (`ReferenceOccurrence[]`, `libs/entities/references.ts`) exactly as that plan defines them. Do not start this plan until Plan 3A/3B is merged.

**Implementation status (2026-09-11):** Tasks 1–5 are implemented locally: MiniSearch and `SearchDocument`, non-aggregate search loaders, normalizers, `loadSearchDataset`, and the one-index provider mounted in the root layout. Representative successful entity, event, volume, and chapter mutations now upsert/discard their documents. The emulator-backed loader verification remains pending because no Firestore emulator is reachable in this workspace. Phase 3D/3E and 3F remain explicitly deferred as described below.

## Global Constraints

- Exactly **one** `MiniSearch` instance for the whole app session — no per-novel, per-volume, or per-chapter index (spec Section 3/10).
- `storeFields: []` on the MiniSearch instance (spec Section 9) — every field needed to render or route a result comes from the provider's own document map, keyed by `SearchDocument.id`, never from MiniSearch's stored fields.
- `SearchDocument.referenceIds` / `referenceNames` / `referenceTypes` / `aliases` are **deduplicated projections**, not parallel arrays — resolve id → current name/type through the entity map at normalization time, not from the stale `label` captured when a reference was authored (spec Section 5, "Entity renames refresh projected names on dependent search documents").
- Loading must not duplicate source reads or use aggregate-computing helpers (`getVolumes`' per-volume `getCountFromServer` calls) the UI needs but search does not (spec Section 10).
- Firestore domain modules (`libs/firebase/*`) stay unaware of MiniSearch; `libs/search/*` stays unaware of Firestore internals beyond calling `libs/firebase`/`libs/api` functions.
- This plan delivers the provider's **lifecycle** (mount once, build once, basic single-document `add`/`replace`/`discard`) and wires it into a representative call site per domain. The **staged exact/prefix/fuzzy query**, **`SearchScope` filtering**, and **command palette integration** are Plan 3D/3E's responsibility (a separate plan) — this plan exposes the raw `index`/`documents` map for that plan to build on, plus one intentionally naive `rawSearch(query)` passthrough used only to prove the index is queryable end-to-end. The **entity-rename/tag-rename cascade to all dependents, delete-cascade, and vacuum scheduling** are Plan 3F's responsibility (a separate plan, "incremental maintenance") — this plan's `dependents` map is the data structure that plan will consume, not the cascade logic itself.
- Run `make firebase-emulators` before `corepack pnpm test`. Run `corepack pnpm build && corepack pnpm lint` after each task.

---

### Task 1: Add MiniSearch, remove the dead legacy search contract, define `SearchDocument`

**Files:**

- Modify: `package.json`
- Modify: `app/types.ts` (remove `SearchChapterResult`, `SearchCharacterResult`, `SearchEventResult`, `SearchResult`)
- Create: `libs/search/types.ts`

**Interfaces:**

- Produces: `SearchDocumentType`, `SearchDocument` — consumed by every later task in this plan and by Plan 3D/3E/3F.

`app/types.ts:137-173` (`SearchChapterResult`, `SearchCharacterResult`, `SearchEventResult`, `SearchResult`) are dead code left over from the retired Go API's `GET /novels/:id/search` endpoint (confirmed: zero references anywhere outside `app/types.ts` — the current command palette in `components/commands/CommandPalette.tsx` builds its own ad-hoc `Command` shape and never imports these). Spec Section 5 explicitly calls for replacing this exact legacy contract, so removing it is this plan's first step, not cleanup debt to defer.

- [ ] **Step 1: Add the dependency**

Run: `corepack pnpm add minisearch@^7.2.0`

Verify in `package.json`'s `dependencies`:

```json
    "minisearch": "^7.2.0",
```

- [ ] **Step 2: Remove the dead legacy search types**

In `app/types.ts`, delete lines 137-173 (`SearchChapterResult` through `SearchResult`) entirely. Run `corepack pnpm build` immediately after to confirm nothing else referenced them (expected: it doesn't — this is a verification step, not a risk).

- [ ] **Step 3: Define `SearchDocument`**

Create `libs/search/types.ts`:

```ts
import type { EntityId, EntityType } from "@/libs/entities/types";

export type SearchDocumentType =
  | "novel"
  | "volume"
  | "chapter"
  | "note"
  | "entity"
  | "event";

export interface SearchDocument {
  id: string; // Collision-safe composite source identity — see libs/search/normalize.ts's id builders.
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
}

// Text fields MiniSearch tokenizes. Kept as a single source of truth so the
// provider's `fields` option (Task 4) and Plan 3D's ranking-tier field lists
// can't silently drift apart.
export const SEARCH_TEXT_FIELDS: (keyof SearchDocument)[] = [
  "name",
  "title",
  "author",
  "referenceNames",
  "aliases",
  "tags",
  "content",
  "description",
];
```

- [ ] **Step 4: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml app/types.ts libs/search/types.ts
git commit -m "$(cat <<'EOF'
feat(search): add minisearch dependency and generic SearchDocument model

Removes the dead Search*Result types left over from the retired Go API
search endpoint — they had zero consumers.

EOF
)"
```

---

### Task 2: Purpose-built, non-aggregate search-source loaders

**Files:**

- Modify: `libs/firebase/volumes.ts` (add `getVolumesFlat`)
- Modify: `libs/firebase/volumes.test.ts`
- Modify: `libs/firebase/chapters.ts` (add `getChaptersFlatDetailed`)
- Modify: `libs/firebase/chapters.test.ts`

**Interfaces:**

- Produces: `getVolumesFlat(novelId): Promise<VolumeSearchSource[]>`, `VolumeSearchSource { id: string; novel_id: string; number: number; title: string; description: string }`; `getChaptersFlatDetailed(novelId): Promise<Chapter[]>` (full `Chapter` shape, including `notes`/`description`/`tags`, hydrated the same way `getChapter` hydrates a single chapter) — consumed by Task 3's loader.

`getVolumes()` (`libs/firebase/volumes.ts:71-109`) always computes `chapter_count`/`read_count` via two `getCountFromServer` calls per volume (`volumeAggregates`) — the UI needs those for the volumes list page, but search does not, and running them for every volume on every index build is exactly the "unnecessary aggregate read" the spec calls out. `getChaptersFlat()` (`libs/firebase/chapters.ts:197-225`) already does a single collection-group read across the whole novel (good — reuse that query shape), but it returns `ChapterSummary`, which drops `notes`/`description`/`tags` and skips reference hydration (`hydrateNoteReferences`) entirely — none of the individual-note or reference data search needs.

- [ ] **Step 1: Write the failing test for `getVolumesFlat`**

Add to `libs/firebase/volumes.test.ts`, inside `describe("volumes", ...)`:

```ts
it("getVolumesFlat returns every volume's id/number/title/description without computing aggregates", async () => {
  await createVolume("novel-1", {
    number: 2,
    title: "Second",
    description: "Second arc.",
  });
  await createVolume("novel-1", { number: 1, title: "First" });

  const flat = await getVolumesFlat("novel-1");

  expect(flat).toEqual([
    {
      id: expect.any(String),
      novel_id: "novel-1",
      number: 1,
      title: "First",
      description: "",
    },
    {
      id: expect.any(String),
      novel_id: "novel-1",
      number: 2,
      title: "Second",
      description: "Second arc.",
    },
  ]);
});
```

Add `getVolumesFlat` to the file's import list from `./volumes`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- volumes.test.ts`
Expected: FAIL — `getVolumesFlat is not a function`.

- [ ] **Step 3: Implement `getVolumesFlat`**

Add to `libs/firebase/volumes.ts`, after `getVolumes`:

```ts
export interface VolumeSearchSource {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  description: string;
}

// Unlike getVolumes(), this skips the per-volume chapter_count/read_count
// aggregate reads (volumeAggregates) — search only ever indexes number/title/description.
export async function getVolumesFlat(
  novelId: string,
): Promise<VolumeSearchSource[]> {
  const snapshot = await getDocs(
    query(volumesCol(novelId), orderBy("number", "asc")),
  );
  return snapshot.docs.map((d) => {
    const data = d.data() as VolumeDoc;
    return {
      id: d.id,
      novel_id: novelId,
      number: data.number,
      title: data.title,
      description: data.description ?? "",
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `corepack pnpm test -- volumes.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `getChaptersFlatDetailed`**

Add to `libs/firebase/chapters.test.ts`, inside `describe("getChaptersFlat", ...)` (add a sibling `describe`):

```ts
describe("getChaptersFlatDetailed", () => {
  it("returns full chapter shape (notes, description, tags) across the whole novel in one query", async () => {
    await seedVolume("novel-1", "vol-1");
    const tag = await createTag("novel-1", "Arc");
    const chapter = await createChapter("novel-1", "vol-1", {
      number: 1,
      title: "One",
      description: "Blurb.",
    });
    await linkChapterTag("novel-1", "vol-1", chapter.id, tag.id);
    await updateChapter("novel-1", "vol-1", chapter.id, {
      notes: [
        {
          id: "note-1",
          content: "Something happens.",
          created_at: "2026-09-11T00:00:00.000Z",
          updated_at: "2026-09-11T00:00:00.000Z",
        },
      ],
    });

    const detailed = await getChaptersFlatDetailed("novel-1");

    expect(detailed).toHaveLength(1);
    expect(detailed[0].description).toBe("Blurb.");
    expect(detailed[0].notes).toHaveLength(1);
    expect(detailed[0].notes[0].content).toBe("Something happens.");
    expect(detailed[0].tags.map((t) => t.id)).toEqual([tag.id]);
  });

  it("hydrates reference occurrences on each note the same way getChapter does", async () => {
    await seedVolume("novel-1", "vol-1");
    await createCharacter("novel-1", {
      name: "DetailedFlatCharacter",
      role: "minor",
      description: "",
      aliases: [],
    });
    const chapter = await createChapter("novel-1", "vol-1", {
      number: 1,
      title: "One",
    });
    await updateChapter("novel-1", "vol-1", chapter.id, {
      notes: [
        {
          id: "note-1",
          content: "[[DetailedFlatCharacter]] appears.",
          created_at: "2026-09-11T00:00:00.000Z",
          updated_at: "2026-09-11T00:00:00.000Z",
        },
      ],
    });

    const detailed = await getChaptersFlatDetailed("novel-1");
    expect(detailed[0].notes[0].references?.[0].token).toMatchObject({
      status: "resolved",
    });
  });
});
```

Add `getChaptersFlatDetailed` to the file's import list from `./chapters`.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/firebase/chapters.test.ts`
Expected: FAIL — `getChaptersFlatDetailed is not a function`.

- [ ] **Step 7: Implement `getChaptersFlatDetailed`**

Add to `libs/firebase/chapters.ts`, after `getChaptersFlat`:

```ts
export async function getChaptersFlatDetailed(
  novelId: string,
): Promise<Chapter[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "chapters"), where("novel_id", "==", novelId)),
  );
  const allTags = await getTags(novelId); // one read for the whole novel, mirrors getChaptersByVolume's N+1 avoidance.
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const chapters = await Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data() as ChapterDoc;
      const hydratedNotes = await hydrateNoteReferences(
        novelId,
        data.notes ?? [],
      );
      return toChapter(
        d.id,
        { ...data, notes: hydratedNotes },
        resolveTags(data.tag_ids ?? [], tagsById),
      );
    }),
  );
  return chapters.sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      (a.number ?? Number.MAX_SAFE_INTEGER) -
        (b.number ?? Number.MAX_SAFE_INTEGER),
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/firebase/chapters.test.ts`
Expected: PASS.

- [ ] **Step 9: Export from the API facade**

In `libs/api/index.ts`, add `getVolumesFlat` to the Volumes export line and `getChaptersFlatDetailed` to the Chapters export line:

```ts
export {
  getVolumes,
  getVolume,
  getVolumesFlat,
  createVolume,
  updateVolume,
  deleteVolume,
} from "@/libs/firebase/volumes";
```

```ts
export {
  getChaptersByVolume,
  getChaptersFlat,
  getChaptersFlatDetailed,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  linkChapterTag,
  unlinkChapterTag,
  reorderChapters,
} from "@/libs/firebase/chapters";
```

- [ ] **Step 10: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add libs/firebase/volumes.ts libs/firebase/volumes.test.ts libs/firebase/chapters.ts libs/firebase/chapters.test.ts libs/api/index.ts
git commit -m "$(cat <<'EOF'
feat(search): add non-aggregate volume/chapter loaders for the search index

EOF
)"
```

---

### Task 3: Normalization — Firestore documents to `SearchDocument[]`

**Files:**

- Create: `libs/search/normalize.ts`
- Create: `libs/search/normalize.test.ts`

**Interfaces:**

- Consumes: `Novel`, `Volume`/`VolumeSearchSource`, `Chapter`, `ChapterNote`, `NovelEvent`, `Tag` (`@/app/types`); `Entity`, `EntityId`, `EntityType` (`@/libs/entities/types`); `ReferenceOccurrence` (`@/libs/entities/references`); `formatChapterLabel` (`@/libs/chapterLabel`).
- Produces: `EntityMap` (`Map<EntityId, Entity>`), `normalizeNovel`, `normalizeVolume`, `normalizeChapter`, `normalizeNote`, `normalizeEntity`, `normalizeEvent` — each `(source, ctx: NormalizeContext) => SearchDocument | SearchDocument[]`; consumed by Task 4's loader and by Task 5's mutation handlers, and by Plan 3F's incremental-maintenance diffing.

- [ ] **Step 1: Write the failing tests**

Create `libs/search/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeChapter,
  normalizeEntity,
  normalizeEvent,
  normalizeNote,
  normalizeNovel,
  normalizeVolume,
} from "./normalize";
import type { Entity } from "@/libs/entities/types";
import type { Chapter, Novel, NovelEvent, Tag, Volume } from "@/app/types";
import type { ChapterKindLabels } from "@/libs/chapterLabel";

const ARC_TAG: Tag = { id: "tag-1", novel_id: "novel-1", name: "Arc" };
const TEST_KIND_LABELS: ChapterKindLabels = {
  chapter: "Chapter",
  prologue: "Prologue",
  epilogue: "Epilogue",
  afterword: "Afterword",
  side_story: "Side Story",
  other: "Other",
};

const CHAR_ENTITY: Entity = {
  id: "novel-1:character:char-1",
  novelId: "novel-1",
  type: "character",
  name: "Rimuru Tempest",
  aliases: ["Satoru"],
  description: "",
};
const entityMap = new Map([[CHAR_ENTITY.id, CHAR_ENTITY]]);

function chapter(overrides: Partial<Chapter>): Chapter {
  return {
    id: "ch-1",
    volume_id: "vol-1",
    number: 1,
    sort_order: 1,
    kind: "chapter",
    custom_label: null,
    title: "Awakening",
    summary: "",
    description: "A slime wakes up.",
    notes: [],
    read_at: null,
    tags: [ARC_TAG],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeNovel", () => {
  it("indexes title/author/description and routes to the novel page", () => {
    const novel: Novel = {
      id: "novel-1",
      title: "Tensura",
      author: "Fuse",
      status: "reading",
      description: "A slime story.",
      cover_url: "",
      created_at: "",
      updated_at: "",
    };
    const doc = normalizeNovel(novel);
    expect(doc).toMatchObject({
      id: "novel:novel-1",
      type: "novel",
      novelId: "novel-1",
      title: "Tensura",
      author: "Fuse",
      description: "A slime story.",
      route: "/novels/novel-1",
    });
    expect(doc.referenceIds).toEqual([]);
  });
});

describe("normalizeVolume", () => {
  it("indexes number/title/description and routes to the volume page", () => {
    const volume = {
      id: "vol-1",
      novel_id: "novel-1",
      number: 3,
      title: "Volume Three",
      description: "Rise of Tempest.",
    } as Volume;
    const doc = normalizeVolume(volume);
    expect(doc).toMatchObject({
      id: "volume:novel-1:vol-1",
      type: "volume",
      novelId: "novel-1",
      volumeId: "vol-1",
      name: "3",
      title: "Volume Three",
      description: "Rise of Tempest.",
      route: "/novels/novel-1/volumes/vol-1",
    });
  });
});

describe("normalizeChapter", () => {
  it("indexes formatChapterLabel, title, description, tags, and routes to the chapter page", () => {
    const doc = normalizeChapter("novel-1", chapter({}), entityMap, TEST_KIND_LABELS);
    expect(doc).toMatchObject({
      id: "chapter:novel-1:vol-1:ch-1",
      type: "chapter",
      novelId: "novel-1",
      volumeId: "vol-1",
      chapterId: "ch-1",
      title: "Awakening",
      description: "A slime wakes up.",
      tagIds: ["tag-1"],
      tags: ["Arc"],
      route: "/novels/novel-1/volumes/vol-1/chapters/ch-1",
    });
    expect(doc.name).toContain("Awakening"); // formatChapterLabel output, e.g. "Chapter 1 — Awakening"
  });

  it("does not duplicate note content into the chapter's summary field", () => {
    const withNotes = chapter({
      summary: "Should not appear.",
      notes: [
        { id: "n1", content: "Note text.", created_at: "", updated_at: "" },
      ],
    });
    const doc = normalizeChapter("novel-1", withNotes, entityMap, TEST_KIND_LABELS);
    expect(doc.content ?? "").not.toContain("Should not appear.");
    expect(doc.content ?? "").not.toContain("Note text.");
  });
});

describe("normalizeNote", () => {
  it("creates one document per note with a collision-safe composite id and projects resolved references by current entity name", () => {
    const note = {
      id: "n1",
      content: "[[Rimuru Tempest]] wakes up.",
      references: [
        {
          start: 0,
          length: 20,
          raw: "[[Rimuru Tempest]]",
          token: {
            status: "resolved" as const,
            reference: {
              entityId: CHAR_ENTITY.id,
              entityType: "character" as const,
              label: "Rimuru Tempest",
            },
          },
        },
      ],
      created_at: "",
      updated_at: "",
    };
    const doc = normalizeNote(
      "novel-1",
      "vol-1",
      "ch-1",
      note,
      [ARC_TAG],
      entityMap,
    );
    expect(doc).toMatchObject({
      id: "note:novel-1:vol-1:ch-1:n1",
      type: "note",
      novelId: "novel-1",
      volumeId: "vol-1",
      chapterId: "ch-1",
      noteId: "n1",
      content: "[[Rimuru Tempest]] wakes up.",
      referenceIds: [CHAR_ENTITY.id],
      referenceTypes: ["character"],
      referenceNames: ["Rimuru Tempest"],
      aliases: ["Satoru"],
      tagIds: ["tag-1"],
      tags: ["Arc"],
      route: "/novels/novel-1/volumes/vol-1/chapters/ch-1?note=n1",
    });
  });

  it("prevents legacy-summary note id collisions across chapters via the full composite key", () => {
    const legacyA = normalizeNote(
      "novel-1",
      "vol-1",
      "ch-a",
      {
        id: "legacy-summary",
        content: "A",
        references: [],
        created_at: "",
        updated_at: "",
      },
      [],
      entityMap,
    );
    const legacyB = normalizeNote(
      "novel-1",
      "vol-1",
      "ch-b",
      {
        id: "legacy-summary",
        content: "B",
        references: [],
        created_at: "",
        updated_at: "",
      },
      [],
      entityMap,
    );
    expect(legacyA.id).not.toBe(legacyB.id);
  });

  it("preserves the original authored label in content even after the referenced entity is renamed", () => {
    const renamed = new Map([
      [CHAR_ENTITY.id, { ...CHAR_ENTITY, name: "Rimuru (renamed)" }],
    ]);
    const note = {
      id: "n1",
      content: "[[Rimuru Tempest]] wakes up.",
      references: [
        {
          start: 0,
          length: 20,
          raw: "[[Rimuru Tempest]]",
          token: {
            status: "resolved" as const,
            reference: {
              entityId: CHAR_ENTITY.id,
              entityType: "character" as const,
              label: "Rimuru Tempest",
            },
          },
        },
      ],
      created_at: "",
      updated_at: "",
    };
    const doc = normalizeNote("novel-1", "vol-1", "ch-1", note, [], renamed);
    expect(doc.content).toBe("[[Rimuru Tempest]] wakes up."); // authored text untouched
    expect(doc.referenceNames).toEqual(["Rimuru (renamed)"]); // projected name IS current
  });

  it("does not add unresolved/ambiguous tokens to referenceIds/referenceNames", () => {
    const note = {
      id: "n1",
      content: "[[Nobody]] appears.",
      references: [
        {
          start: 0,
          length: 12,
          raw: "[[Nobody]]",
          token: {
            status: "unresolved" as const,
            typed: null,
            label: "Nobody",
          },
        },
      ],
      created_at: "",
      updated_at: "",
    };
    const doc = normalizeNote("novel-1", "vol-1", "ch-1", note, [], entityMap);
    expect(doc.referenceIds).toEqual([]);
    expect(doc.referenceNames).toEqual([]);
  });
});

describe("normalizeEntity", () => {
  it("indexes name/aliases/description and routes character entities to the existing character detail route", () => {
    const doc = normalizeEntity(CHAR_ENTITY);
    expect(doc).toMatchObject({
      id: `entity:${CHAR_ENTITY.id}`,
      type: "entity",
      entityId: CHAR_ENTITY.id,
      entityType: "character",
      name: "Rimuru Tempest",
      aliases: ["Satoru"],
      route: "/novels/novel-1/characters/char-1",
    });
  });

  it("routes non-character entities to the shared entity detail route", () => {
    const location: Entity = {
      id: "novel-1:location:loc-1",
      novelId: "novel-1",
      type: "location",
      name: "Tempest",
      aliases: [],
      description: "",
    };
    const doc = normalizeEntity(location);
    expect(doc.route).toBe("/novels/novel-1/entities/novel-1:location:loc-1");
  });
});

describe("normalizeEvent", () => {
  it("indexes title/description, the current linked chapter label, and resolved references", () => {
    const event: NovelEvent = {
      id: "ev-1",
      novel_id: "novel-1",
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
      chapter_title: "Awakening",
      chapter_number: 1,
      page_number: 3,
      title: "Rimuru wakes",
      description: "[[Rimuru Tempest]] wakes up.",
      story_date: "",
      sort_order: 0,
      character_ids: [],
      character_names: [],
      created_at: "",
      updated_at: "",
    };
    const doc = normalizeEvent(event, chapter({}), entityMap, TEST_KIND_LABELS);
    expect(doc).toMatchObject({
      id: "event:novel-1:ev-1",
      type: "event",
      novelId: "novel-1",
      eventId: "ev-1",
      title: "Rimuru wakes",
      route: "/novels/novel-1/timeline#event-ev-1",
    });
    expect(doc.content ?? "").toContain("Awakening"); // current chapter label, not the snapshot chapter_title
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/search/normalize.test.ts`
Expected: FAIL — `Cannot find module './normalize'`.

- [ ] **Step 3: Implement normalization**

Create `libs/search/normalize.ts`:

```ts
import type {
  Chapter,
  ChapterNote,
  Novel,
  NovelEvent,
  Tag,
  Volume,
} from "@/app/types";
import type { Entity, EntityId } from "@/libs/entities/types";
import { formatChapterLabel } from "@/libs/chapterLabel";
import type { ChapterKindLabels } from "@/libs/chapterLabel";
import type { VolumeSearchSource } from "@/libs/firebase/volumes";
import type { SearchDocument } from "./types";

export type EntityMap = Map<EntityId, Entity>;

function projectResolvedReferences(
  notes: {
    references?: import("@/libs/entities/references").ReferenceOccurrence[];
  }[],
  entityMap: EntityMap,
) {
  const ids = new Set<EntityId>();
  notes.forEach((note) =>
    (note.references ?? []).forEach(({ token }) => {
      if (token.status === "resolved") ids.add(token.reference.entityId);
    }),
  );
  const referenceIds = [...ids];
  const entities = referenceIds
    .map((id) => entityMap.get(id))
    .filter((e): e is Entity => Boolean(e));
  return {
    referenceIds,
    referenceTypes: entities.map((e) => e.type),
    referenceNames: [...new Set(entities.map((e) => e.name))],
    aliases: [...new Set(entities.flatMap((e) => e.aliases))],
  };
}

export function novelRoute(novelId: string) {
  return `/novels/${novelId}`;
}
export function volumeRoute(novelId: string, volumeId: string) {
  return `${novelRoute(novelId)}/volumes/${volumeId}`;
}
export function chapterRoute(
  novelId: string,
  volumeId: string,
  chapterId: string,
) {
  return `${volumeRoute(novelId, volumeId)}/chapters/${chapterId}`;
}
export function entityRoute(entity: Pick<Entity, "id" | "novelId" | "type">) {
  return entity.type === "character"
    ? `${novelRoute(entity.novelId)}/characters/${entity.id.split(":").slice(2).join(":")}`
    : `${novelRoute(entity.novelId)}/entities/${entity.id}`;
}

export function normalizeNovel(novel: Novel): SearchDocument {
  return {
    id: `novel:${novel.id}`,
    type: "novel",
    novelId: novel.id,
    title: novel.title,
    author: novel.author,
    description: novel.description,
    referenceIds: [],
    referenceNames: [],
    referenceTypes: [],
    aliases: [],
    tagIds: [],
    tags: [],
    route: novelRoute(novel.id),
  };
}

export function normalizeVolume(
  volume:
    | Pick<Volume, "id" | "novel_id" | "number" | "title" | "description">
    | VolumeSearchSource,
): SearchDocument {
  return {
    id: `volume:${volume.novel_id}:${volume.id}`,
    type: "volume",
    novelId: volume.novel_id,
    volumeId: volume.id,
    name: String(volume.number),
    title: volume.title,
    description: volume.description,
    referenceIds: [],
    referenceNames: [],
    referenceTypes: [],
    aliases: [],
    tagIds: [],
    tags: [],
    route: volumeRoute(volume.novel_id, volume.id),
  };
}

export function normalizeChapter(
  novelId: string,
  chapter: Chapter,
  entityMap: EntityMap,
  kindLabels: ChapterKindLabels,
): SearchDocument {
  const chapterReferenceIds = new Set<EntityId>();
  chapter.notes.forEach((note) =>
    (note.references ?? []).forEach(({ token }) => {
      if (token.status === "resolved")
        chapterReferenceIds.add(token.reference.entityId);
    }),
  );
  const projected = projectResolvedReferences(
    [{ references: chapter.notes.flatMap((n) => n.references ?? []) }],
    entityMap,
  );
  return {
    id: `chapter:${novelId}:${chapter.volume_id}:${chapter.id}`,
    type: "chapter",
    novelId,
    volumeId: chapter.volume_id,
    chapterId: chapter.id,
    name: formatChapterLabel(chapter, kindLabels),
    title: chapter.title,
    description: chapter.description,
    // Note content lives in its own "note" documents (see normalizeNote) — never duplicated here.
    ...projected,
    tagIds: chapter.tags.map((t) => t.id),
    tags: chapter.tags.map((t) => t.name),
    route: chapterRoute(novelId, chapter.volume_id, chapter.id),
  };
}

export function normalizeNote(
  novelId: string,
  volumeId: string,
  chapterId: string,
  note: ChapterNote,
  tags: Tag[],
  entityMap: EntityMap,
): SearchDocument {
  const projected = projectResolvedReferences([note], entityMap);
  return {
    id: `note:${novelId}:${volumeId}:${chapterId}:${note.id}`,
    type: "note",
    novelId,
    volumeId,
    chapterId,
    noteId: note.id,
    content: note.content, // authored text is never rewritten — see spec Section 4/5.
    ...projected,
    tagIds: tags.map((t) => t.id),
    tags: tags.map((t) => t.name), // notes inherit the chapter's tags (spec Section 6).
    route: `${chapterRoute(novelId, volumeId, chapterId)}?note=${note.id}`,
  };
}

export function normalizeEntity(entity: Entity): SearchDocument {
  return {
    id: `entity:${entity.id}`,
    type: "entity",
    novelId: entity.novelId,
    entityId: entity.id,
    entityType: entity.type,
    name: entity.name,
    description: entity.description,
    referenceIds: [],
    referenceNames: [],
    referenceTypes: [],
    aliases: entity.aliases,
    tagIds: [],
    tags: [],
    route: entityRoute(entity),
  };
}

export function normalizeEvent(
  event: NovelEvent,
  linkedChapter: Chapter | null,
  entityMap: EntityMap,
  kindLabels: ChapterKindLabels,
): SearchDocument {
  const projected = projectResolvedReferences(
    [{ references: event.description_references }],
    entityMap,
  );
  const chapterLabel = linkedChapter
    ? formatChapterLabel(linkedChapter, kindLabels)
    : (event.chapter_title ?? "");
  return {
    id: `event:${event.novel_id}:${event.id}`,
    type: "event",
    novelId: event.novel_id,
    chapterId: event.chapter_id ?? undefined,
    volumeId: event.chapter_volume_id ?? undefined,
    eventId: event.id,
    title: event.title,
    content: `${event.description} ${chapterLabel}`.trim(),
    ...projected,
    tagIds: [],
    tags: [],
    route: `${novelRoute(event.novel_id)}/timeline#event-${event.id}`,
  };
}
```

`normalizeEvent` receives `ChapterKindLabels` from the provider, alongside `normalizeChapter`; its tests use `TEST_KIND_LABELS`. This keeps the normalizer pure and keeps user-visible chapter labels consistent with the current locale.

- [ ] **Step 4: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add libs/search/normalize.ts libs/search/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(search): normalize Firestore documents into SearchDocument

EOF
)"
```

---

### Task 4: Purpose-built loader

**Files:**

- Create: `libs/search/loader.ts`
- Create: `libs/search/loader.test.ts`

**Interfaces:**

- Consumes: `getNovels`, `getVolumesFlat`, `getChaptersFlatDetailed`, `getAllCharacters`, `getEntities`, `getEvents`, `getTags` (`@/libs/api`); every `normalize*` function and `EntityMap` from Task 3.
- Produces: `loadSearchDataset(): Promise<{ documents: SearchDocument[]; entityMap: EntityMap }>` — consumed by Task 5's provider.

- [ ] **Step 1: Write the failing test**

Create `libs/search/loader.test.ts` — this is an integration-style test against the Firestore emulator (same pattern as `libs/firebase/*.test.ts`), proving the loader assembles a coherent dataset from real domain writes rather than mocking every `libs/api` call:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestoreEmulator, useEmulator } from "@/libs/firebase/testUtils";
import { createNovel } from "@/libs/firebase/novels";
import { createVolume } from "@/libs/firebase/volumes";
import { createChapter, updateChapter } from "@/libs/firebase/chapters";
import { createCharacter } from "@/libs/firebase/characters";
import { createEntity } from "@/libs/firebase/entities";
import { createEvent } from "@/libs/firebase/events";
import { loadSearchDataset } from "./loader";

const KIND_LABELS = {
  chapter: "Chapter",
  prologue: "Prologue",
  epilogue: "Epilogue",
  afterword: "Afterword",
  side_story: "Side Story",
  other: "Other",
};

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("loadSearchDataset", () => {
  it("loads novels, volumes, chapters, notes, characters, generic entities, and events into one flat document list", async () => {
    const novel = await createNovel({
      title: "Tensura",
      author: "Fuse",
      status: "reading",
      description: "",
      cover_url: "",
    });
    const volume = await createVolume(novel.id, {
      number: 1,
      title: "Volume One",
    });
    const chapter = await createChapter(novel.id, volume.id, {
      number: 1,
      title: "Awakening",
    });
    await updateChapter(novel.id, volume.id, chapter.id, {
      notes: [
        {
          id: "n1",
          content: "It begins.",
          created_at: "2026-09-11T00:00:00.000Z",
          updated_at: "2026-09-11T00:00:00.000Z",
        },
      ],
    });
    await createCharacter(novel.id, {
      name: "Rimuru",
      role: "protagonist",
      description: "",
      aliases: [],
    });
    await createEntity(novel.id, {
      type: "location",
      name: "Tempest",
      aliases: [],
      description: "",
    });
    await createEvent(novel.id, { title: "Arrival", description: "" });

    const { documents, entityMap } = await loadSearchDataset(KIND_LABELS);

    const typeCounts = documents.reduce<Record<string, number>>(
      (acc, d) => ({ ...acc, [d.type]: (acc[d.type] ?? 0) + 1 }),
      {},
    );
    expect(typeCounts).toEqual({
      novel: 1,
      volume: 1,
      chapter: 1,
      note: 1,
      entity: 2,
      event: 1,
    });
    expect(entityMap.size).toBe(2); // one character + one location
  });

  it("returns an empty dataset when there are no novels", async () => {
    const { documents, entityMap } = await loadSearchDataset(KIND_LABELS);
    expect(documents).toEqual([]);
    expect(entityMap.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/loader.test.ts`
Expected: FAIL — `Cannot find module './loader'`.

- [ ] **Step 3: Implement the loader**

Create `libs/search/loader.ts`:

```ts
import {
  getNovels,
  getVolumesFlat,
  getChaptersFlatDetailed,
  getAllCharacters,
  getEntities,
  getEvents,
  getTags,
} from "@/libs/api";
import { GENERIC_ENTITY_TYPES } from "@/libs/entities/types";
import { buildEntityId } from "@/libs/entities/keys";
import type { Entity } from "@/libs/entities/types";
import type { ChapterKindLabels } from "@/libs/chapterLabel";
import {
  normalizeChapter,
  normalizeEntity,
  normalizeEvent,
  normalizeNote,
  normalizeNovel,
  normalizeVolume,
  type EntityMap,
} from "./normalize";
import type { SearchDocument } from "./types";

async function loadNovelDataset(
  novelId: string,
  kindLabels: ChapterKindLabels,
): Promise<{ documents: SearchDocument[]; entities: Entity[] }> {
  const [volumes, chapters, characters, tags, events, ...genericByType] =
    await Promise.all([
      getVolumesFlat(novelId),
      getChaptersFlatDetailed(novelId),
      getAllCharacters(novelId),
      getTags(novelId),
      getEvents(novelId),
      ...GENERIC_ENTITY_TYPES.map((type) => getEntities(novelId, type)),
    ]);

  const characterEntities: Entity[] = characters.map((c) => ({
    id: buildEntityId(novelId, "character", c.id),
    novelId,
    type: "character" as const,
    name: c.name,
    aliases: c.aliases,
    description: c.description,
  }));
  const entities = [...characterEntities, ...genericByType.flat()];
  const entityMap: EntityMap = new Map(entities.map((e) => [e.id, e]));

  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  const documents: SearchDocument[] = [
    ...volumes.map((v) => normalizeVolume(v)),
    ...chapters.map((c) => normalizeChapter(novelId, c, entityMap, kindLabels)),
    ...chapters.flatMap((c) =>
      c.notes.map((note) =>
        normalizeNote(
          novelId,
          c.volume_id,
          c.id,
          note,
          c.tags.length
            ? c.tags
            : c.tags
                .map((t) => t)
                .filter(() => false)
                .concat(c.tags),
          entityMap,
        ),
      ),
    ),
    ...entities.map((e) => normalizeEntity(e)),
    ...events.map((e) =>
      normalizeEvent(
        e,
        e.chapter_id ? (chapterById.get(e.chapter_id) ?? null) : null,
        entityMap,
        kindLabels,
      ),
    ),
  ];

  return { documents, entities };
}

export async function loadSearchDataset(
  kindLabels: ChapterKindLabels,
): Promise<{ documents: SearchDocument[]; entityMap: EntityMap }> {
  const novels = await getNovels();
  const perNovel = await Promise.all(
    novels.map((novel) => loadNovelDataset(novel.id, kindLabels)),
  );

  const documents = [
    normalizeNovel.length ? [] : [],
    ...perNovel.map((n) => n.documents),
  ].flat();
  const allDocuments = [...novels.map((n) => normalizeNovel(n)), ...documents];
  const entityMap: EntityMap = new Map(
    perNovel.flatMap((n) => n.entities).map((e) => [e.id, e]),
  );

  return { documents: allDocuments, entityMap };
}
```

Fix the note-tags line above (it's deliberately convoluted to flag as wrong in review) — replace it with the straightforward form once implementing:

```ts
    ...chapters.flatMap((c) => c.notes.map((note) => normalizeNote(novelId, c.volume_id, c.id, note, c.tags, entityMap))),
```

(Notes inherit the chapter's own `tags` array, already resolved by `getChaptersFlatDetailed`/`toChapter` — no separate lookup needed.) Also simplify the `documents` assembly in `loadSearchDataset` to drop the dead `normalizeNovel.length ? [] : []` no-op:

```ts
export async function loadSearchDataset(
  kindLabels: ChapterKindLabels,
): Promise<{ documents: SearchDocument[]; entityMap: EntityMap }> {
  const novels = await getNovels();
  const perNovel = await Promise.all(
    novels.map((novel) => loadNovelDataset(novel.id, kindLabels)),
  );

  const documents: SearchDocument[] = [
    ...novels.map((n) => normalizeNovel(n)),
    ...perNovel.flatMap((n) => n.documents),
  ];
  const entityMap: EntityMap = new Map(
    perNovel.flatMap((n) => n.entities).map((e) => [e.id, e]),
  );

  return { documents, entityMap };
}
```

Pass `kindLabels` to every `normalizeEvent` call (`(event, chapter, entityMap, kindLabels)`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/search/loader.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/search/loader.ts libs/search/loader.test.ts
git commit -m "$(cat <<'EOF'
feat(search): add purpose-built, non-aggregate dataset loader

EOF
)"
```

---

### Task 5: `SearchIndexProvider` — one index, mounted once, basic mutations

**Files:**

- Create: `libs/search/buildIndex.ts`
- Create: `libs/search/buildIndex.test.ts`
- Create: `libs/search/SearchIndexProvider.tsx`
- Modify: `app/layout.tsx`
- Modify: `locales/en.ts`, `locales/th.ts` (loading/error copy)

**Interfaces:**

- Consumes: `loadSearchDataset` (Task 4), `SearchDocument`/`SEARCH_TEXT_FIELDS` (Task 1), `useChapterKindLabels` (`@/components/chapters/ChapterLabel`).
- Produces: `buildIndex(documents): MiniSearch<SearchDocument>` (standalone, so a later ranking plan can build a real index in its own tests without duplicating this config), `SearchIndexProvider` (component), `useSearchIndex(): SearchIndexContextValue`, `useSearchMutations(): SearchMutations` — `index`/`documents`/`dependents` consumed directly by the follow-up scope/ranking/command-palette plan; `add`/`replace`/`discard` consumed by Task 6 of this plan and by the incremental-maintenance plan's cascade logic.

- [ ] **Step 1: Write the failing test for `buildIndex`**

Create `libs/search/buildIndex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIndex } from "./buildIndex";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "d1",
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

describe("buildIndex", () => {
  it("indexes array fields (e.g. tags) as space-joined text via extractField", () => {
    const index = buildIndex([
      doc({ id: "d1", title: "Ordinary Title", tags: ["Flashback", "Arc"] }),
    ]);
    expect(index.search("Flashback")).toHaveLength(1);
  });

  it("does not store any fields — storeFields is empty", () => {
    const index = buildIndex([doc({ id: "d1", title: "Findable" })]);
    const [result] = index.search("Findable");
    expect(result.title).toBeUndefined();
  });

  it("supports incremental add/replace/discard by id", () => {
    const index = buildIndex([]);
    index.add(doc({ id: "d1", title: "Alpha" }));
    expect(index.search("Alpha")).toHaveLength(1);
    index.replace(doc({ id: "d1", title: "Beta" }));
    expect(index.search("Alpha")).toHaveLength(0);
    expect(index.search("Beta")).toHaveLength(1);
    index.discard("d1");
    expect(index.search("Beta")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- libs/search/buildIndex.test.ts`
Expected: FAIL — `Cannot find module './buildIndex'`.

- [ ] **Step 3: Implement `buildIndex`**

Create `libs/search/buildIndex.ts`:

```ts
import MiniSearch from "minisearch";
import { SEARCH_TEXT_FIELDS, type SearchDocument } from "./types";

export function buildIndex(
  documents: SearchDocument[],
): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>({
    idField: "id",
    fields: SEARCH_TEXT_FIELDS as string[],
    storeFields: [], // Global Constraint: resolve all result metadata through the documents map instead.
    extractField: (document, fieldName) => {
      const value = (document as unknown as Record<string, unknown>)[fieldName];
      return Array.isArray(value) ? value.join(" ") : ((value as string) ?? "");
    },
  });
  index.addAll(documents);
  return index;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `corepack pnpm test -- libs/search/buildIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, and commit this step before continuing**

Run: `corepack pnpm build && corepack pnpm lint`

```bash
git add libs/search/buildIndex.ts libs/search/buildIndex.test.ts
git commit -m "$(cat <<'EOF'
feat(search): extract buildIndex as a standalone, independently testable function

EOF
)"
```

- [ ] **Step 6: Implement the provider using `buildIndex`**

Create `libs/search/SearchIndexProvider.tsx`:

```tsx
"use client";

import type MiniSearch from "minisearch";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EntityId } from "@/libs/entities/types";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import { buildIndex } from "./buildIndex";
import { loadSearchDataset } from "./loader";
import type { SearchDocument } from "./types";

type Status = "idle" | "loading" | "ready" | "error";

export interface SearchIndexContextValue {
  status: Status;
  error: string | null;
  index: MiniSearch<SearchDocument> | null;
  documents: Map<string, SearchDocument>;
  dependents: Map<EntityId, Set<string>>;
  reload: () => void;
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);

function buildDependents(
  documents: SearchDocument[],
): Map<EntityId, Set<string>> {
  const dependents = new Map<EntityId, Set<string>>();
  documents.forEach((doc) =>
    doc.referenceIds.forEach((entityId) => {
      const set = dependents.get(entityId) ?? new Set<string>();
      set.add(doc.id);
      dependents.set(entityId, set);
    }),
  );
  return dependents;
}

export function SearchIndexProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const kindLabels = useChapterKindLabels();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<MiniSearch<SearchDocument> | null>(null);
  const [documents, setDocuments] = useState<Map<string, SearchDocument>>(
    new Map(),
  );
  const [dependents, setDependents] = useState<Map<EntityId, Set<string>>>(
    new Map(),
  );
  const buildIdRef = useRef(0); // guards against a stale build overwriting a newer one (Global Constraints).

  const reload = useCallback(() => {
    const buildId = ++buildIdRef.current;
    setStatus("loading");
    setError(null);
    void loadSearchDataset(kindLabels)
      .then(({ documents: docs }) => {
        if (buildIdRef.current !== buildId) return; // a newer reload superseded this one.
        setIndex(buildIndex(docs));
        setDocuments(new Map(docs.map((d) => [d.id, d])));
        setDependents(buildDependents(docs));
        setStatus("ready");
      })
      .catch((cause) => {
        if (buildIdRef.current !== buildId) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to build the search index.",
        );
        setStatus("error");
      });
  }, [kindLabels]);

  useEffect(() => {
    reload();
    // Deliberately runs once on mount only — normal rerenders, route changes, and scope
    // changes must not rebuild the index (Global Constraints / spec Section 10).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SearchIndexContextValue>(
    () => ({ status, error, index, documents, dependents, reload }),
    [status, error, index, documents, dependents, reload],
  );

  return (
    <SearchIndexContext.Provider value={value}>
      {children}
    </SearchIndexContext.Provider>
  );
}

export function useSearchIndex(): SearchIndexContextValue {
  const ctx = useContext(SearchIndexContext);
  if (!ctx)
    throw new Error("useSearchIndex must be used within a SearchIndexProvider");
  return ctx;
}

export interface SearchMutations {
  upsert: (doc: SearchDocument) => void;
  discard: (id: string) => void;
}

// Single-document add/replace/discard only — Plan 3F ("incremental maintenance")
// builds the entity-rename/tag-rename/delete-cascade orchestration on top of these
// primitives plus the `dependents` map above.
export function useSearchMutations(): SearchMutations {
  const ctx = useContext(SearchIndexContext);
  if (!ctx)
    throw new Error(
      "useSearchMutations must be used within a SearchIndexProvider",
    );

  const upsert = useCallback(
    (doc: SearchDocument) => {
      if (!ctx.index) return; // index not built yet — the eventual reload() will pick this document up.
      if (ctx.documents.has(doc.id)) ctx.index.replace(doc);
      else ctx.index.add(doc);
      ctx.documents.set(doc.id, doc);
    },
    [ctx],
  );

  const discard = useCallback(
    (id: string) => {
      if (!ctx.index || !ctx.documents.has(id)) return;
      ctx.index.discard(id);
      ctx.documents.delete(id);
    },
    [ctx],
  );

  return { upsert, discard };
}
```

- [ ] **Step 7: Mount the provider**

In `app/layout.tsx`, wrap the existing children with the provider:

```tsx
import { SearchIndexProvider } from "@/libs/search/SearchIndexProvider";
```

```tsx
<I18nProvider>
  <SearchIndexProvider>
    <LanguageToggle />
    <CommandPalette />
    {children}
  </SearchIndexProvider>
</I18nProvider>
```

(`SearchIndexProvider` must be inside `I18nProvider` because `useChapterKindLabels()` calls `useI18n()`.)

- [ ] **Step 8: Manual verification**

There is no component test harness in this repo (confirmed: no RTL/jsdom setup anywhere) — verify this task with `corepack pnpm build && corepack pnpm lint` (type-check) plus a manual check:

With `make firebase-emulators` and `corepack pnpm dev` running, open the app, open the browser console, and confirm no errors are thrown on load. Add a temporary `console.log(useSearchIndex())` inside any existing client component (e.g. `CommandPalette`) to confirm `status` transitions `"idle"` → `"loading"` → `"ready"` and `documents.size` matches the seeded data — remove the temporary log before committing.

- [ ] **Step 9: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add libs/search/SearchIndexProvider.tsx app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(search): add SearchIndexProvider — one MiniSearch index per app session

EOF
)"
```

---

### Task 6: Wire mutations from a representative call site per domain

**Files:**

- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx` (worked example: chapter update)
- Modify: `app/novels/[id]/entities/[entityId]/EntityDetail.tsx` (worked example: entity update — from Plan 3A/3B Task 7)
- Modify: `app/novels/[id]/timeline/page.tsx` (worked example: event create/update/delete)
- Checklist (replicate the same pattern; do not write out separately): `app/novels/[id]/AddVolumeForm.tsx`, `app/novels/[id]/VolumeManager.tsx`, `app/novels/[id]/AddChapterForm.tsx`, `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx`, `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`, `app/novels/[id]/entities/EntityList.tsx`, `app/novels/page.tsx` (`AddNovelForm` is currently disabled per `docs/engineering/PROGRESS.md` — skip it; wire it if/when that item ships)

**Interfaces:**

- Consumes: `useSearchMutations` (Task 5), `normalizeChapter`/`normalizeEntity`/`normalizeEvent` (Task 3), `useChapterKindLabels`.

The provider (Task 5) only builds the index once on mount; without this task, any create/update/delete made after that first load never reaches the index until a full page reload. This task establishes the pattern — call the matching `normalize*` function on the just-saved data, then `upsert`/`discard` — and lists every remaining call site that needs the identical treatment. Deleting a chapter/entity/event must also discard its dependents (e.g. deleting a chapter should discard all of its note documents too) — Plan 3F ("incremental maintenance") formalizes cascading discard via the `dependents` map; until that lands, this task's delete wiring only discards the single document being deleted, which is a real but explicitly acknowledged gap (documented in Plan 3F's Global Constraints, not silently left broken).

- [ ] **Step 1: Worked example — chapter update**

In `ChapterEditor.tsx`, import the mutation hook and normalizer:

```tsx
import { useSearchMutations } from "@/libs/search/SearchIndexProvider";
import { normalizeChapter } from "@/libs/search/normalize";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
```

Inside the component, alongside the existing hooks:

```tsx
const { upsert } = useSearchMutations();
const kindLabels = useChapterKindLabels();
```

In `saveTitle`, `saveSummary`, and `saveReadAt` (each already calls `updateChapter(...)` then `router.refresh()`), add one line after the successful `await updateChapter(...)` call, before `router.refresh()`:

```tsx
upsert(
  normalizeChapter(
    novelId,
    { ...chapter, title: normalizedTitle },
    new Map(),
    kindLabels,
  ),
);
```

(adjust the spread per field being saved — `saveSummary` spreads `{ ...chapter, summary }`, `saveReadAt` spreads `{ ...chapter, read_at: normalizeDateTimeLocalToISOString(readAt) }`). Passing `new Map()` for the entity map here is intentionally conservative: reference projections (`referenceNames`/`aliases`) will be stale until the next full `reload()`, but `title`/`description`/`tags` — the fields users actually just edited — are correct immediately. Plan 3F's cascade logic replaces this with the provider's real, populated entity map.

- [ ] **Step 2: Worked example — entity update**

In `EntityDetail.tsx` (from Plan 3A/3B Task 7), after a successful `updateEntity(...)` call:

```tsx
const { upsert } = useSearchMutations();
// ...
upsert(normalizeEntity({ ...entity, name, aliases, description }));
```

And after a successful `deleteEntity(...)` call:

```tsx
const { discard } = useSearchMutations();
// ...
discard(`entity:${entity.id}`);
```

- [ ] **Step 3: Worked example — event create/update/delete**

In `app/novels/[id]/timeline/page.tsx`, import `useSearchMutations`/`normalizeEvent`/`useChapterKindLabels`, and:

- In `handleAdd`, after `await createEvent(novelId, toPayload(addForm))` succeeds, call `upsert(normalizeEvent(created, linkedChapter, new Map(), kindLabels))` (capture the `createEvent` return value; it currently discards it into `await loadEvents()` instead — capture it as `const created = await createEvent(...)` and still call `loadEvents()` for the on-page list).
- In `handleEdit`, same pattern after `updateEvent(...)`.
- In `handleDelete`, call `discard(`event:${novelId}:${confirmDeleteEvent.id}`)` after `deleteEvent(...)` succeeds.

- [ ] **Step 4: Replicate for the remaining call sites**

Apply the identical shape (import the hook + relevant normalizer, call `upsert`/`discard` right after the existing successful Firestore call, before or alongside the existing `router.refresh()`/local-state update) to every file in this task's checklist above. Each of those files already follows the same "call the `libs/api` function, update local state, show a `Snackbar`" shape documented earlier in this session's other plans (e.g. `docs/superpowers/plans/2026-09-10-volume-chapter-description.md`) — there is nothing novel in any of them beyond picking the right `normalize*` call and composite id for `discard`.

- [ ] **Step 5: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: edit a chapter title, then (per Task 5 Step 3's temporary-log technique, or a future Plan 3E command palette) confirm the index's document map reflects the new title without a full page reload.

- [ ] **Step 6: Commit**

```bash
git add "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx" "app/novels/[id]/entities/[entityId]/EntityDetail.tsx" "app/novels/[id]/timeline/page.tsx" "app/novels/[id]/AddVolumeForm.tsx" "app/novels/[id]/VolumeManager.tsx" "app/novels/[id]/AddChapterForm.tsx" "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx" "app/novels/[id]/characters/[characterId]/CharacterDetail.tsx" "app/novels/[id]/entities/EntityList.tsx"
git commit -m "$(cat <<'EOF'
feat(search): wire incremental index mutations into mutation call sites

EOF
)"
```

---

## Verification Against the Spec

Satisfies spec Section 15: "SearchDocument uses referenceIds/referenceNames/referenceTypes/aliases with tags separate" (Task 1/3), "Search includes novels, volumes, chapters, notes, all six entity types, and timeline events" (Task 3/4), "One index is reused across scopes, keystrokes, and route changes; normal saves use incremental updates" (Task 5/6), "Note IDs cannot collide across chapters/novels, including legacy summaries" (Task 3's `normalizeNote` composite id), "No duplicated per-scope indexes or unnecessary storeFields" (Task 1/5).

Deferred to the next plan (Phase 3D/3E — a separate plan document): `SearchScope`, the staged exact/prefix/fuzzy query, field-priority ranking, and the command palette UI. Deferred to Phase 3F (a separate plan document): entity/tag rename cascades, delete cascades, stale-build recovery beyond the `buildIdRef` guard above, and vacuum scheduling.
