# Phase 3A+3B: Timeline Audit + Entity Reference System Implementation Plan

**Goal:** Lock in a regression-tested baseline for the shipped timeline (story order, chapter labels, character filtering), then add the generic six-type Entity Reference System — stable entity IDs, typed/untyped `[[...]]` parsing, occurrence bindings, and full backward compatibility with the existing character-only `character_ids`/`mentioned_character_names` data.

**Architecture:** `novels/{novelId}/characters/{characterId}` stays the authoritative character store. A new `novels/{novelId}/entities/{entityId}` collection holds the other five types (`location`, `skill`, `organization`, `item`, `concept`). A shared `libs/entities/` module provides the `EntityId`/`Entity`/`EntityReference` contract, a resolver that parses `[[...]]` syntax against both stores, and an occurrence-binding reconciler so saved references survive renames and unrelated edits. `libs/firebase/chapters.ts` and `libs/firebase/events.ts` gain a generic `references: ReferenceOccurrence[]` field per content string, while deriving the legacy `character_ids`/`mentioned_character_names` fields from the character subset of those references — so every existing consumer (character filters, chapter counts, event UI) keeps working unchanged.

**Tech Stack:** Next.js 16 / React 19, Cloud Firestore (Firebase Web SDK), Vitest + Firestore emulator.

**Spec:** `docs/superpowers/specs/2026-09-11-novelndex_phase_3_timeline_search-design.md` — Sections 4 (Generic Entity Reference System), 13 (Timeline Requirements), and Implementation Slices 3A/3B.

## Global Constraints

- `EntityId` format: `` `${novelId}:${entityType}:${sourceRecordId}` `` — for `type: "character"`, `sourceRecordId` is the existing `novels/{novelId}/characters/{characterId}` document ID (so existing character IDs/routes never change); for the other five types, `sourceRecordId` is the new `novels/{novelId}/entities/{entityId}` document's own ID. This mirrors the composite-ID convention `components/commands/CommandPalette.tsx` already uses for its command IDs (e.g. `` `character:${novel.id}:${character.id}` ``).
- Untyped `[[Name]]` resolves **only** against `type: "character"` — never infers another type from a name match, per spec Section 4.
- A reference is **resolved**, **ambiguous**, or **unresolved** — never silently pick the first candidate, never auto-create an entity from an unresolved mention.
- Occurrence bindings are persisted (not re-derived from text on every read) so renames/unrelated edits don't retarget a saved reference. Reconciliation only re-resolves tokens whose authored bracket text actually changed.
- Legacy `character_ids` / `mentioned_character_names` on `Chapter`/`ChapterNote`/`NovelEvent` remain and are derived from the character subset of the new generic references — not from a second parser. Existing character filters, chapter counts (`libs/firebase/characters.ts`'s `characterChapters`), and event UI keep working with zero call-site changes.
- Migration/backfill is idempotent, preserves every existing document/note ID, and never invents a new note.
- Run `make firebase-emulators` before `corepack pnpm test`. Run `corepack pnpm build && corepack pnpm lint` after each task.
- No Go API, Redis, `NEXT_PUBLIC_API_URL`, or HTTP search endpoint (`docs/ai/CLAUDE.md` guardrail) — everything here is Firestore + client code.

---

### Task 1: Extract and regression-test the timeline story-order comparator

**Files:**

- Create: `libs/timelineOrder.ts`
- Create: `libs/timelineOrder.test.ts`
- Modify: `app/novels/[id]/timeline/page.tsx:20-24` (`eventOrder`), `:13` (`ChapterOption`)

**Interfaces:**

- Produces: `eventOrder(a: NovelEvent, b: NovelEvent, chapters: ChapterOrderInput[], volumes: VolumeOrderInput[]): number`, `ChapterOrderInput { id: string; volume_id: string; sort_order: number }`, `VolumeOrderInput { id: string; number: number }` — consumed by `app/novels/[id]/timeline/page.tsx` (unchanged behavior) and by Task 4's event-reference work.

This is the audit half of Phase 3A: the story-order rule (`volume.number → chapter.sort_order → page_number → event.sort_order`, spec Section 13) already ships inline in the timeline page with no test coverage. Extract it to a pure module so it's independently verifiable before anything in this plan touches the timeline further.

- [ ] **Step 1: Write the failing tests**

Create `libs/timelineOrder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventOrder } from "./timelineOrder";
import type { NovelEvent } from "@/app/types";

const CH_A = { id: "ch-a", volume_id: "vol-1", sort_order: 1 };
const CH_B = { id: "ch-b", volume_id: "vol-1", sort_order: 2 };
const CH_C = { id: "ch-c", volume_id: "vol-2", sort_order: 1 };
const VOL_1 = { id: "vol-1", number: 1 };
const VOL_2 = { id: "vol-2", number: 2 };

function event(overrides: Partial<NovelEvent>): NovelEvent {
  return {
    id: "e",
    novel_id: "n",
    chapter_id: null,
    chapter_volume_id: null,
    chapter_title: null,
    chapter_number: null,
    page_number: null,
    title: "",
    description: "",
    story_date: "",
    sort_order: 0,
    character_ids: [],
    character_names: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("eventOrder", () => {
  it("orders by volume.number first", () => {
    const a = event({
      id: "a",
      chapter_id: "ch-c",
      chapter_volume_id: "vol-2",
    });
    const b = event({
      id: "b",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
    });
    expect(eventOrder(b, a, [CH_A, CH_B, CH_C], [VOL_1, VOL_2])).toBeLessThan(
      0,
    );
  });

  it("orders by chapter.sort_order within the same volume", () => {
    const a = event({
      id: "a",
      chapter_id: "ch_b",
      chapter_volume_id: "vol-1",
    });
    const b = event({
      id: "b",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
    });
    expect(
      eventOrder(
        b,
        event({ id: "a", chapter_id: "ch-b", chapter_volume_id: "vol-1" }),
        [CH_A, CH_B, CH_C],
        [VOL_1, VOL_2],
      ),
    ).toBeLessThan(0);
  });

  it("orders by page_number within the same chapter", () => {
    const a = event({
      id: "a",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
      page_number: 5,
    });
    const b = event({
      id: "b",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
      page_number: 2,
    });
    expect(eventOrder(b, a, [CH_A, CH_B, CH_C], [VOL_1, VOL_2])).toBeLessThan(
      0,
    );
  });

  it("falls back to event.sort_order on the same page", () => {
    const a = event({
      id: "a",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
      page_number: 5,
      sort_order: 2,
    });
    const b = event({
      id: "b",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
      page_number: 5,
      sort_order: 1,
    });
    expect(eventOrder(b, a, [CH_A, CH_B, CH_C], [VOL_1, VOL_2])).toBeLessThan(
      0,
    );
  });

  it("sorts unplaced events (no chapter_id) after all placed events", () => {
    const placed = event({
      id: "placed",
      chapter_id: "ch-a",
      chapter_volume_id: "vol-1",
    });
    const unplaced = event({
      id: "unplaced",
      chapter_id: null,
      chapter_volume_id: null,
    });
    expect(
      eventOrder(placed, unplaced, [CH_A, CH_B, CH_C], [VOL_1, VOL_2]),
    ).toBeLessThan(0);
  });

  it("uses the event id as a deterministic tie-breaker for equally-placed unplaced events", () => {
    const a = event({
      id: "a",
      chapter_id: null,
      chapter_volume_id: null,
      sort_order: 3,
    });
    const b = event({
      id: "b",
      chapter_id: null,
      chapter_volume_id: null,
      sort_order: 3,
    });
    expect(eventOrder(a, b, [CH_A, CH_B, CH_C], [VOL_1, VOL_2])).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- timelineOrder.test.ts`
Expected: FAIL — `Cannot find module './timelineOrder'`.

- [ ] **Step 3: Extract the implementation**

Create `libs/timelineOrder.ts` with the exact logic currently inline in `app/novels/[id]/timeline/page.tsx:20-24`, generalized to plain input shapes so it has no dependency on the page's local `ChapterOption`/`Volume` types:

```ts
import type { NovelEvent } from "@/app/types";

export interface ChapterOrderInput {
  id: string;
  volume_id: string;
  sort_order: number;
}

export interface VolumeOrderInput {
  id: string;
  number: number;
}

const UNKNOWN = Number.MAX_SAFE_INTEGER;

export function eventOrder(
  a: NovelEvent,
  b: NovelEvent,
  chapters: ChapterOrderInput[],
  volumes: VolumeOrderInput[],
): number {
  const ca = chapters.find((x) => x.id === a.chapter_id);
  const cb = chapters.find((x) => x.id === b.chapter_id);
  const va = volumes.find(
    (x) => x.id === (a.chapter_volume_id ?? ca?.volume_id),
  );
  const vb = volumes.find(
    (x) => x.id === (b.chapter_volume_id ?? cb?.volume_id),
  );
  return (
    [
      (va?.number ?? UNKNOWN) - (vb?.number ?? UNKNOWN),
      (ca?.sort_order ?? UNKNOWN) - (cb?.sort_order ?? UNKNOWN),
      (a.page_number ?? UNKNOWN) - (b.page_number ?? UNKNOWN),
      a.sort_order - b.sort_order,
      a.id.localeCompare(b.id),
    ].find((x) => x !== 0) ?? 0
  );
}
```

In `app/novels/[id]/timeline/page.tsx`, replace the local `eventOrder` function (line 20-24) with an import:

```tsx
import { eventOrder } from "@/libs/timelineOrder";
```

(Delete the local function body; `ChapterOption` at line 13 already has `id`, `volume_id`, `sort_order` so it satisfies `ChapterOrderInput` structurally — no other change needed at the call site on line 39.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- timelineOrder.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Type-check, lint, and manually verify the timeline is unchanged**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running, open a novel's timeline page, confirm events still group by volume/chapter and order the same as before (no visual change expected — this task only extracts and tests existing logic).

- [ ] **Step 6: Commit**

```bash
git add libs/timelineOrder.ts libs/timelineOrder.test.ts "app/novels/[id]/timeline/page.tsx"
git commit -m "$(cat <<'EOF'
test(timeline): extract and regression-test the story-order comparator

EOF
)"
```

---

### Task 2: Entity contract, `EntityId` keys, and the `entities` Firestore domain

**Files:**

- Create: `libs/entities/types.ts`
- Create: `libs/entities/keys.ts`
- Create: `libs/entities/keys.test.ts`
- Create: `libs/firebase/entities.ts`
- Create: `libs/firebase/entities.test.ts`
- Modify: `libs/api/index.ts`
- Modify: `firestore.rules` (no change needed — `allow read, write: if true` already covers any collection under `novels/{novelId}/**`, confirm this in the test step, don't add a redundant rule)

**Interfaces:**

- Produces: `EntityType`, `EntityId`, `Entity`, `buildEntityId(novelId, type, sourceRecordId): EntityId`, `parseEntityId(id: EntityId): { novelId: string; type: EntityType; sourceRecordId: string } | null`, `getEntities(novelId, type?)`, `getEntity(novelId, entityId)`, `createEntity(novelId, payload)`, `updateEntity(novelId, entityId, payload)`, `deleteEntity(novelId, entityId)` — consumed by Task 3 (resolver), Task 4 (compatibility layer), and Plan 2 (SearchDocument normalization).

- [ ] **Step 1: Define the shared entity contract**

Create `libs/entities/types.ts`:

```ts
export type EntityType =
  | "character"
  | "location"
  | "skill"
  | "organization"
  | "item"
  | "concept";

export const ENTITY_TYPES: EntityType[] = [
  "character",
  "location",
  "skill",
  "organization",
  "item",
  "concept",
];

// The five types stored in the new `entities` collection — "character" keeps
// living in `novels/{novelId}/characters/{characterId}` (see libs/firebase/characters.ts).
export const GENERIC_ENTITY_TYPES: Exclude<EntityType, "character">[] = [
  "location",
  "skill",
  "organization",
  "item",
  "concept",
];

// Immutable, novel/type-qualified key. Never derived from name — see libs/entities/keys.ts.
export type EntityId = string;

export interface Entity {
  id: EntityId;
  novelId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description: string;
}

// Original authored display text is not identity — only entityId/entityType are.
export interface EntityReference {
  entityId: EntityId;
  entityType: EntityType;
  label: string;
}
```

- [ ] **Step 2: Write the failing key-encoding tests**

Create `libs/entities/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildEntityId, parseEntityId } from "./keys";

describe("buildEntityId / parseEntityId", () => {
  it("round-trips a character entity id", () => {
    const id = buildEntityId("novel-1", "character", "char-abc");
    expect(id).toBe("novel-1:character:char-abc");
    expect(parseEntityId(id)).toEqual({
      novelId: "novel-1",
      type: "character",
      sourceRecordId: "char-abc",
    });
  });

  it("round-trips a generic entity id", () => {
    const id = buildEntityId("novel-1", "location", "loc-abc");
    expect(parseEntityId(id)).toEqual({
      novelId: "novel-1",
      type: "location",
      sourceRecordId: "loc-abc",
    });
  });

  it("returns null for a malformed id", () => {
    expect(parseEntityId("not-an-entity-id")).toBeNull();
  });

  it("returns null for an id with an unknown entity type", () => {
    expect(parseEntityId("novel-1:vehicle:abc")).toBeNull();
  });

  it("stays collision-safe when a source record id itself contains a colon-like Firestore id", () => {
    // Firestore auto-IDs are alphanumeric (no colons), so splitting on the first two
    // colons only is safe; this test documents that assumption.
    const id = buildEntityId("novel-1", "item", "Ab12Cd34");
    expect(parseEntityId(id)?.sourceRecordId).toBe("Ab12Cd34");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `corepack pnpm test -- keys.test.ts`
Expected: FAIL — `Cannot find module './keys'`.

- [ ] **Step 4: Implement the key codec**

Create `libs/entities/keys.ts`:

```ts
import {
  ENTITY_TYPES,
  type Entity,
  type EntityId,
  type EntityType,
} from "./types";

export function buildEntityId(
  novelId: string,
  type: EntityType,
  sourceRecordId: string,
): EntityId {
  return `${novelId}:${type}:${sourceRecordId}`;
}

export function parseEntityId(
  id: EntityId,
): { novelId: string; type: EntityType; sourceRecordId: string } | null {
  const [novelId, type, ...rest] = id.split(":");
  const sourceRecordId = rest.join(":");
  if (!novelId || !type || !sourceRecordId) return null;
  if (!ENTITY_TYPES.includes(type as EntityType)) return null;
  return { novelId, type: type as EntityType, sourceRecordId };
}

export function entityIdFor(
  entity: Pick<Entity, "novelId" | "type" | "id">,
): EntityId {
  return entity.id;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `corepack pnpm test -- keys.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing Firestore domain tests**

Create `libs/firebase/entities.test.ts`, following the exact emulator setup pattern in `libs/firebase/characters.ts`'s test file:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";
import {
  createEntity,
  deleteEntity,
  getEntities,
  getEntity,
  updateEntity,
} from "./entities";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("entities", () => {
  it("creates an entity with a novel/type-qualified id", async () => {
    const entity = await createEntity("novel-1", {
      type: "location",
      name: "Tempest",
      aliases: ["Rimuru's Forest"],
      description: "A monster settlement.",
    });

    expect(entity.id).toMatch(/^novel-1:location:/);
    expect(entity.novelId).toBe("novel-1");
    expect(entity.type).toBe("location");
    expect(entity.name).toBe("Tempest");
    expect(entity.aliases).toEqual(["Rimuru's Forest"]);
  });

  it("rejects a character type — characters stay in the characters collection", async () => {
    await expect(
      // @ts-expect-error — "character" is intentionally not a valid generic entity type here
      createEntity("novel-1", {
        type: "character",
        name: "X",
        aliases: [],
        description: "",
      }),
    ).rejects.toThrow();
  });

  it("lists entities filtered by type, ordered by name", async () => {
    await createEntity("novel-1", {
      type: "skill",
      name: "Predator",
      aliases: [],
      description: "",
    });
    await createEntity("novel-1", {
      type: "location",
      name: "Zephyr",
      aliases: [],
      description: "",
    });
    await createEntity("novel-1", {
      type: "location",
      name: "Anzu",
      aliases: [],
      description: "",
    });

    const locations = await getEntities("novel-1", "location");
    expect(locations.map((e) => e.name)).toEqual(["Anzu", "Zephyr"]);
  });

  it("updates name/aliases/description", async () => {
    const entity = await createEntity("novel-1", {
      type: "item",
      name: "Sword",
      aliases: [],
      description: "",
    });
    const updated = await updateEntity("novel-1", entity.id, {
      name: "Dragon Sword",
      aliases: ["The Sword"],
    });
    expect(updated.name).toBe("Dragon Sword");
    expect(updated.aliases).toEqual(["The Sword"]);
    expect(updated.description).toBe("");
  });

  it("throws when getting an entity that does not exist", async () => {
    await expect(
      getEntity("novel-1", "novel-1:concept:missing"),
    ).rejects.toThrow();
  });

  it("deletes an entity", async () => {
    const entity = await createEntity("novel-1", {
      type: "organization",
      name: "Federation",
      aliases: [],
      description: "",
    });
    await deleteEntity("novel-1", entity.id);
    await expect(getEntity("novel-1", entity.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/firebase/entities.test.ts`
Expected: FAIL — `Cannot find module './entities'`.

- [ ] **Step 8: Implement the entities Firestore domain**

Create `libs/firebase/entities.ts`, mirroring `libs/firebase/characters.ts`'s shape:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Entity } from "@/libs/entities/types";
import { GENERIC_ENTITY_TYPES, type EntityType } from "@/libs/entities/types";
import { buildEntityId } from "@/libs/entities/keys";
import { db } from "./app";
import { withCreateTimestamps, withUpdateTimestamp } from "./helpers";

type GenericEntityType = Exclude<EntityType, "character">;

interface EntityDoc {
  type: GenericEntityType;
  name: string;
  aliases: string[];
  description: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

function entitiesCol(novelId: string) {
  return collection(db, "novels", novelId, "entities");
}

function entityRef(novelId: string, sourceRecordId: string) {
  return doc(db, "novels", novelId, "entities", sourceRecordId);
}

function toEntity(novelId: string, id: string, data: EntityDoc): Entity {
  return {
    id: buildEntityId(novelId, data.type, id),
    novelId,
    type: data.type,
    name: data.name,
    aliases: data.aliases ?? [],
    description: data.description ?? "",
  };
}

function assertGenericType(
  type: EntityType,
): asserts type is GenericEntityType {
  if (!GENERIC_ENTITY_TYPES.includes(type as GenericEntityType)) {
    throw new Error(
      `"${type}" is not a generic entity type — characters live in libs/firebase/characters.ts`,
    );
  }
}

export interface EntityCreatePayload {
  type: GenericEntityType;
  name: string;
  aliases: string[];
  description: string;
}

export async function createEntity(
  novelId: string,
  payload: EntityCreatePayload,
): Promise<Entity> {
  assertGenericType(payload.type);
  const ref = await addDoc(
    entitiesCol(novelId),
    withCreateTimestamps({
      type: payload.type,
      name: payload.name,
      aliases: payload.aliases,
      description: payload.description,
    }),
  );
  const snapshot = await getDoc(ref);
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export interface EntityUpdatePayload {
  name?: string;
  aliases?: string[];
  description?: string;
}

export async function updateEntity(
  novelId: string,
  entityId: string,
  payload: EntityUpdatePayload,
): Promise<Entity> {
  const sourceRecordId = entityId.split(":").slice(2).join(":");
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.aliases !== undefined) update.aliases = payload.aliases;
  if (payload.description !== undefined)
    update.description = payload.description;
  const ref = entityRef(novelId, sourceRecordId);
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function getEntity(
  novelId: string,
  entityId: string,
): Promise<Entity> {
  const sourceRecordId = entityId.split(":").slice(2).join(":");
  const snapshot = await getDoc(entityRef(novelId, sourceRecordId));
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function getEntities(
  novelId: string,
  type?: GenericEntityType,
): Promise<Entity[]> {
  const base = type
    ? query(entitiesCol(novelId), where("type", "==", type), orderBy("name"))
    : query(entitiesCol(novelId), orderBy("name"));
  const snapshot = await getDocs(base);
  return snapshot.docs.map((d) =>
    toEntity(novelId, d.id, d.data() as EntityDoc),
  );
}

export async function deleteEntity(
  novelId: string,
  entityId: string,
): Promise<void> {
  const sourceRecordId = entityId.split(":").slice(2).join(":");
  await deleteDoc(entityRef(novelId, sourceRecordId));
}
```

Note: the type-filtered query (`where("type", "==", ...) + orderBy("name")`) needs a composite index once real data volume requires it — Firestore's emulator and small novels won't hit `FAILED_PRECONDITION`, but add the index in `firestore.indexes.json` in Task 6 of this plan alongside the other index additions, once the full read pattern from Task 4/5 is known.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/firebase/entities.test.ts`
Expected: PASS.

- [ ] **Step 10: Export from the API facade**

In `libs/api/index.ts`, add a new section after the "Character roles domain" block:

```ts
// Entities domain via Firestore (location/skill/organization/item/concept)
export {
  getEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
} from "@/libs/firebase/entities";
export type {
  EntityCreatePayload,
  EntityUpdatePayload,
} from "@/libs/firebase/entities";
export type {
  Entity,
  EntityId,
  EntityType,
  EntityReference,
} from "@/libs/entities/types";
```

- [ ] **Step 11: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add libs/entities/ libs/firebase/entities.ts libs/firebase/entities.test.ts libs/api/index.ts
git commit -m "$(cat <<'EOF'
feat(entities): add shared entity contract and Firestore domain for the five generic entity types

EOF
)"
```

---

### Task 3: Typed/untyped reference parsing and resolution

**Files:**

- Create: `libs/entities/references.ts`
- Create: `libs/entities/references.test.ts`

**Interfaces:**

- Consumes: `Entity`, `EntityReference`, `EntityType`, `ENTITY_TYPES` from Task 2's `libs/entities/types.ts`.
- Produces: `ReferenceToken`, `ReferenceOccurrence`, `extractReferenceTokens(content: string): RawToken[]`, `resolveReferenceOccurrences(content: string, lookup: EntityLookup): Promise<ReferenceOccurrence[]>`, `EntityLookup` — consumed by Task 4 (chapter/event persistence) and Plan 2 (search normalization, which reads `referenceIds`/`referenceNames`/`referenceTypes` off resolved occurrences).

This is the core parser from spec Section 4 ("Syntax and resolution"). It has no Firestore dependency — `EntityLookup` is injected so this module is testable in isolation and reusable by both `libs/firebase/chapters.ts` and `libs/firebase/events.ts` in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `libs/entities/references.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  extractReferenceTokens,
  resolveReferenceOccurrences,
  type EntityLookup,
} from "./references";
import type { Entity } from "./types";

function entity(overrides: Partial<Entity>): Entity {
  return {
    id: "e",
    novelId: "novel-1",
    type: "character",
    name: "",
    aliases: [],
    description: "",
    ...overrides,
  };
}

const RIMURU = entity({
  id: "novel-1:character:char-1",
  type: "character",
  name: "Rimuru Tempest",
});
const TEMPEST_LOCATION = entity({
  id: "novel-1:location:loc-1",
  type: "location",
  name: "Tempest",
});
const TEMPEST_CHAR_ALIAS = entity({
  id: "novel-1:character:char-2",
  type: "character",
  name: "Tempest",
  aliases: ["Storm"],
});

function lookupFor(entities: Entity[]): EntityLookup {
  return {
    async findByName(novelId, name, type) {
      const needle = name.trim().toLocaleLowerCase();
      return entities.filter(
        (e) =>
          e.novelId === novelId &&
          (type === undefined || e.type === type) &&
          (e.name.toLocaleLowerCase() === needle ||
            e.aliases.some((a) => a.toLocaleLowerCase() === needle)),
      );
    },
  };
}

describe("extractReferenceTokens", () => {
  it("extracts an untyped token", () => {
    const tokens = extractReferenceTokens("[[Rimuru Tempest]] woke up.");
    expect(tokens).toEqual([
      {
        raw: "[[Rimuru Tempest]]",
        start: 0,
        length: 19,
        typed: null,
        label: "Rimuru Tempest",
      },
    ]);
  });

  it("extracts a typed token", () => {
    const tokens = extractReferenceTokens(
      "They traveled to [[location:Tempest]].",
    );
    expect(tokens[0]).toMatchObject({ typed: "location", label: "Tempest" });
  });

  it("ignores an unknown type prefix as part of the label, not a type", () => {
    const tokens = extractReferenceTokens("[[vehicle:Car]] appears.");
    expect(tokens[0]).toMatchObject({ typed: null, label: "vehicle:Car" });
  });

  it("finds multiple tokens with correct offsets", () => {
    const content = "[[Rimuru Tempest]] fought [[character:Hinata]].";
    const tokens = extractReferenceTokens(content);
    expect(tokens).toHaveLength(2);
    expect(
      content.slice(tokens[1].start, tokens[1].start + tokens[1].length),
    ).toBe("[[character:Hinata]]");
  });

  it("returns no tokens for plain prose", () => {
    expect(extractReferenceTokens("Rimuru fought Hinata.")).toEqual([]);
  });
});

describe("resolveReferenceOccurrences", () => {
  it("resolves an untyped token to a character only", async () => {
    const lookup = lookupFor([RIMURU, TEMPEST_LOCATION]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[Rimuru Tempest]] woke up.",
      lookup,
    );
    expect(occurrences[0].token).toEqual({
      status: "resolved",
      reference: {
        entityId: RIMURU.id,
        entityType: "character",
        label: "Rimuru Tempest",
      },
    });
  });

  it("does not let an untyped label cross-resolve to a non-character type", async () => {
    const lookup = lookupFor([TEMPEST_LOCATION]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[Tempest]] was quiet.",
      lookup,
    );
    expect(occurrences[0].token).toMatchObject({ status: "unresolved" });
  });

  it("resolves a typed token to the matching type only", async () => {
    const lookup = lookupFor([TEMPEST_LOCATION, TEMPEST_CHAR_ALIAS]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[location:Tempest]] was quiet.",
      lookup,
    );
    expect(occurrences[0].token).toEqual({
      status: "resolved",
      reference: {
        entityId: TEMPEST_LOCATION.id,
        entityType: "location",
        label: "Tempest",
      },
    });
  });

  it("marks ambiguous when two entities of the requested type share a name/alias", async () => {
    const dup1 = entity({
      id: "novel-1:location:a",
      type: "location",
      name: "Zephyr",
    });
    const dup2 = entity({
      id: "novel-1:location:b",
      type: "location",
      name: "Zephyr",
    });
    const lookup = lookupFor([dup1, dup2]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[location:Zephyr]] loomed.",
      lookup,
    );
    expect(occurrences[0].token).toMatchObject({
      status: "ambiguous",
      candidates: expect.arrayContaining([dup1.id, dup2.id]),
    });
  });

  it("marks unresolved for an unknown name", async () => {
    const lookup = lookupFor([]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[Nobody]] appears.",
      lookup,
    );
    expect(occurrences[0].token).toEqual({
      status: "unresolved",
      typed: null,
      label: "Nobody",
    });
  });

  it("resolves via alias, preserving the authored label", async () => {
    const lookup = lookupFor([TEMPEST_CHAR_ALIAS]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[character:Storm]] arrived.",
      lookup,
    );
    expect(occurrences[0].token).toEqual({
      status: "resolved",
      reference: {
        entityId: TEMPEST_CHAR_ALIAS.id,
        entityType: "character",
        label: "Storm",
      },
    });
  });

  it("trims and case-folds the label before lookup but preserves the original label in the reference", async () => {
    const lookup = lookupFor([RIMURU]);
    const occurrences = await resolveReferenceOccurrences(
      "novel-1",
      "[[ rimuru tempest ]] spoke.",
      lookup,
    );
    expect(occurrences[0].token).toEqual({
      status: "resolved",
      reference: {
        entityId: RIMURU.id,
        entityType: "character",
        label: "rimuru tempest",
      },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/entities/references.test.ts`
Expected: FAIL — `Cannot find module './references'`.

- [ ] **Step 3: Implement the parser and resolver**

Create `libs/entities/references.ts`:

```ts
import {
  ENTITY_TYPES,
  type Entity,
  type EntityId,
  type EntityReference,
  type EntityType,
} from "./types";

const REFERENCE_PATTERN = /\[\[([^\]]+)\]\]/g;

export interface RawReferenceToken {
  raw: string;
  start: number;
  length: number;
  typed: EntityType | null;
  label: string;
}

export type ReferenceToken =
  | { status: "resolved"; reference: EntityReference }
  | { status: "unresolved"; typed: EntityType | null; label: string }
  | {
      status: "ambiguous";
      typed: EntityType | null;
      label: string;
      candidates: EntityId[];
    };

export interface ReferenceOccurrence {
  start: number;
  length: number;
  raw: string;
  token: ReferenceToken;
}

export interface EntityLookup {
  findByName(
    novelId: string,
    name: string,
    type?: EntityType,
  ): Promise<Entity[]>;
}

function splitTypedLabel(inner: string): {
  typed: EntityType | null;
  label: string;
} {
  const colonIndex = inner.indexOf(":");
  if (colonIndex === -1) return { typed: null, label: inner.trim() };
  const prefix = inner.slice(0, colonIndex).trim();
  if (ENTITY_TYPES.includes(prefix as EntityType)) {
    return {
      typed: prefix as EntityType,
      label: inner.slice(colonIndex + 1).trim(),
    };
  }
  // Unknown prefix (e.g. "vehicle:Car") is not a type — the whole inner text is the label.
  return { typed: null, label: inner.trim() };
}

export function extractReferenceTokens(content: string): RawReferenceToken[] {
  const tokens: RawReferenceToken[] = [];
  for (const match of content.matchAll(REFERENCE_PATTERN)) {
    const inner = match[1];
    const { typed, label } = splitTypedLabel(inner);
    if (!label) continue;
    tokens.push({
      raw: match[0],
      start: match.index ?? 0,
      length: match[0].length,
      typed,
      label,
    });
  }
  return tokens;
}

async function resolveToken(
  novelId: string,
  token: RawReferenceToken,
  lookup: EntityLookup,
): Promise<ReferenceToken> {
  const requestedType = token.typed ?? "character"; // untyped syntax resolves only against "character"
  const candidates = await lookup.findByName(
    novelId,
    token.label,
    requestedType,
  );
  if (candidates.length === 1) {
    const [entity] = candidates;
    return {
      status: "resolved",
      reference: {
        entityId: entity.id,
        entityType: entity.type,
        label: token.label,
      },
    };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      typed: token.typed,
      label: token.label,
      candidates: candidates.map((e) => e.id),
    };
  }
  return { status: "unresolved", typed: token.typed, label: token.label };
}

export async function resolveReferenceOccurrences(
  novelId: string,
  content: string,
  lookup: EntityLookup,
): Promise<ReferenceOccurrence[]> {
  const tokens = extractReferenceTokens(content);
  const resolved = await Promise.all(
    tokens.map((token) => resolveToken(novelId, token, lookup)),
  );
  return tokens.map((token, index) => ({
    start: token.start,
    length: token.length,
    raw: token.raw,
    token: resolved[index],
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/entities/references.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/entities/references.ts libs/entities/references.test.ts
git commit -m "$(cat <<'EOF'
feat(entities): add typed/untyped [[reference]] parsing and resolution

EOF
)"
```

---

### Task 4: Occurrence reconciliation (rename/edit-safe bindings)

**Files:**

- Create: `libs/entities/reconcile.ts`
- Create: `libs/entities/reconcile.test.ts`

**Interfaces:**

- Consumes: `ReferenceOccurrence`, `resolveReferenceOccurrences`, `EntityLookup` from Task 3.
- Produces: `reconcileReferenceOccurrences(novelId, content, previous: { content: string; occurrences: ReferenceOccurrence[] } | null, lookup): Promise<ReferenceOccurrence[]>` — consumed by Task 5 (`libs/firebase/chapters.ts`, `libs/firebase/events.ts`).

Spec Section 4 requires renames and unrelated text edits to preserve existing bindings, while genuinely new or changed tokens re-resolve. The policy implemented here: if content is byte-for-byte unchanged, reuse every previous occurrence untouched (cheapest, matches `libs/firebase/chapters.ts`'s existing `previous?.content === note.content` fast path). Otherwise, match each new raw token against the previous occurrences by raw text as a consumed multiset, in document order — a raw token seen before and not yet "claimed" by an earlier new token reuses its prior binding; anything left over (new text, or more occurrences of the same raw text than existed before) is freshly resolved.

- [ ] **Step 1: Write the failing tests**

Create `libs/entities/reconcile.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { reconcileReferenceOccurrences } from "./reconcile";
import type { EntityLookup } from "./references";
import type { Entity } from "./types";

const RIMURU: Entity = {
  id: "novel-1:character:1",
  novelId: "novel-1",
  type: "character",
  name: "Rimuru",
  aliases: [],
  description: "",
};

function lookupFor(entities: Entity[]): EntityLookup {
  return {
    async findByName(novelId, name, type) {
      return entities.filter(
        (e) =>
          e.novelId === novelId &&
          (type === undefined || e.type === type) &&
          e.name === name,
      );
    },
  };
}

describe("reconcileReferenceOccurrences", () => {
  it("reuses every occurrence untouched when content is unchanged", async () => {
    const lookup = lookupFor([RIMURU]);
    const spy = vi.spyOn(lookup, "findByName");
    const content = "[[Rimuru]] woke up.";
    const first = await reconcileReferenceOccurrences(
      "novel-1",
      content,
      null,
      lookup,
    );

    spy.mockClear();
    const second = await reconcileReferenceOccurrences(
      "novel-1",
      content,
      { content, occurrences: first },
      lookup,
    );

    expect(second).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
  });

  it("preserves a resolved binding through an unrelated text edit", async () => {
    const lookup = lookupFor([RIMURU]);
    const before = "[[Rimuru]] woke up.";
    const first = await reconcileReferenceOccurrences(
      "novel-1",
      before,
      null,
      lookup,
    );

    // Rename the entity out from under the lookup — reconciliation must NOT re-resolve
    // the untouched "[[Rimuru]]" token, so it keeps pointing at the same entityId.
    const emptyLookup = lookupFor([]);
    const after = "[[Rimuru]] woke up in a cold sweat.";
    const second = await reconcileReferenceOccurrences(
      "novel-1",
      after,
      { content: before, occurrences: first },
      emptyLookup,
    );

    expect(second[0].token).toEqual(first[0].token);
  });

  it("re-resolves a token whose bracket text actually changed", async () => {
    const lookup = lookupFor([RIMURU]);
    const before = "[[Nobody]] appeared.";
    const first = await reconcileReferenceOccurrences(
      "novel-1",
      before,
      null,
      lookup,
    );
    expect(first[0].token).toMatchObject({ status: "unresolved" });

    const after = "[[Rimuru]] appeared.";
    const second = await reconcileReferenceOccurrences(
      "novel-1",
      after,
      { content: before, occurrences: first },
      lookup,
    );
    expect(second[0].token).toEqual({
      status: "resolved",
      reference: {
        entityId: RIMURU.id,
        entityType: "character",
        label: "Rimuru",
      },
    });
  });

  it("resolves a newly-inserted second occurrence of the same raw text independently", async () => {
    const lookup = lookupFor([RIMURU]);
    const before = "[[Rimuru]] woke up.";
    const first = await reconcileReferenceOccurrences(
      "novel-1",
      before,
      null,
      lookup,
    );

    const after = "[[Rimuru]] woke up. [[Rimuru]] again.";
    const second = await reconcileReferenceOccurrences(
      "novel-1",
      after,
      { content: before, occurrences: first },
      lookup,
    );
    expect(second).toHaveLength(2);
    expect(second[0].token).toEqual(first[0].token);
    expect(second[1].token).toMatchObject({ status: "resolved" });
  });

  it("does not retarget a binding when the referenced name is deleted and an unrelated new entity is recreated with the same name", async () => {
    const lookup = lookupFor([RIMURU]);
    const before = "[[Rimuru]] spoke.";
    const first = await reconcileReferenceOccurrences(
      "novel-1",
      before,
      null,
      lookup,
    );

    const recreated: Entity = { ...RIMURU, id: "novel-1:character:2" };
    const after = "[[Rimuru]] spoke loudly.";
    const second = await reconcileReferenceOccurrences(
      "novel-1",
      after,
      { content: before, occurrences: first },
      lookupFor([recreated]),
    );

    // Unrelated edit -> untouched token -> keeps the ORIGINAL binding, not the new entity id.
    expect(second[0].token).toMatchObject({
      reference: { entityId: RIMURU.id },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/entities/reconcile.test.ts`
Expected: FAIL — `Cannot find module './reconcile'`.

- [ ] **Step 3: Implement reconciliation**

Create `libs/entities/reconcile.ts`:

```ts
import {
  extractReferenceTokens,
  resolveReferenceOccurrences,
  type EntityLookup,
  type ReferenceOccurrence,
} from "./references";

export interface PreviousReferenceState {
  content: string;
  occurrences: ReferenceOccurrence[];
}

export async function reconcileReferenceOccurrences(
  novelId: string,
  content: string,
  previous: PreviousReferenceState | null,
  lookup: EntityLookup,
): Promise<ReferenceOccurrence[]> {
  if (previous && previous.content === content) return previous.occurrences;

  const newTokens = extractReferenceTokens(content);
  const availableByRaw = new Map<string, ReferenceOccurrence[]>();
  (previous?.occurrences ?? []).forEach((occurrence) => {
    const bucket = availableByRaw.get(occurrence.raw) ?? [];
    bucket.push(occurrence);
    availableByRaw.set(occurrence.raw, bucket);
  });

  const results: (ReferenceOccurrence | null)[] = newTokens.map((token) => {
    const bucket = availableByRaw.get(token.raw);
    const reused = bucket?.shift();
    if (!reused) return null;
    return {
      start: token.start,
      length: token.length,
      raw: token.raw,
      token: reused.token,
    };
  });

  const unresolvedIndexes = results
    .map((result, index) => (result === null ? index : null))
    .filter((index): index is number => index !== null);

  if (unresolvedIndexes.length > 0) {
    const freshlyResolved = await resolveReferenceOccurrences(
      novelId,
      unresolvedIndexes
        .map((index) =>
          content.slice(
            newTokens[index].start,
            newTokens[index].start + newTokens[index].length,
          ),
        )
        .join(" "),
      lookup,
    );
    // resolveReferenceOccurrences re-extracts tokens from the joined snippet, so its
    // output order matches unresolvedIndexes order 1:1 (each snippet contains exactly one token).
    unresolvedIndexes.forEach((index, position) => {
      const token = newTokens[index];
      results[index] = {
        start: token.start,
        length: token.length,
        raw: token.raw,
        token: freshlyResolved[position].token,
      };
    });
  }

  return results as ReferenceOccurrence[];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/entities/reconcile.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/entities/reconcile.ts libs/entities/reconcile.test.ts
git commit -m "$(cat <<'EOF'
feat(entities): reconcile reference occurrences so renames/edits preserve bindings

EOF
)"
```

---

### Task 5: Wire generic references into chapter notes and events, deriving the legacy character fields

**Files:**

- Modify: `libs/firebase/chapters.ts`
- Modify: `libs/firebase/chapters.test.ts`
- Modify: `libs/firebase/events.ts`
- Modify: `libs/firebase/events.test.ts`
- Modify: `app/types.ts` (`ChapterNote`, `NovelEvent`)

**Interfaces:**

- Consumes: `reconcileReferenceOccurrences`, `EntityLookup`, `ReferenceOccurrence` from Task 4; `getEntities`/`getEntity` from Task 2; `getCharactersByNames`/`getCharactersByIds` from `libs/firebase/characters.ts` (unchanged).
- Produces: `ChapterNote.references: ReferenceOccurrence[]`, `NovelEvent.description_references: ReferenceOccurrence[]` — consumed by Plan 2 (SearchDocument normalization reads `referenceIds`/`referenceNames`/`referenceTypes` off these).

This is the highest-risk task in the plan: it replaces `libs/firebase/chapters.ts`'s character-only `extractMentions`/`hydrateLegacyNoteRelations`/`resolveChangedNoteRelations` machinery with the generic resolver, while keeping every existing output (`character_ids`, `mentioned_character_names`, `character_mention_counts`, `mentioned_character_name_counts`) byte-identical for character-only content. Do this incrementally: add the generic `EntityLookup` implementation and `references` field first, prove the legacy fields still derive correctly from it, and only then remove the old character-only helpers.

- [ ] **Step 1: Write the failing tests for `libs/firebase/chapters.ts`**

Add to `libs/firebase/chapters.test.ts`, inside `describe("chapters", ...)`:

```ts
it("resolves a generic [[location:...]] reference in a note and keeps legacy character fields derived from the character subset only", async () => {
  await seedVolume("novel-1", "vol-1");
  const character = await createCharacter("novel-1", {
    name: "TestGenericCharacter",
    role: "minor",
    description: "",
    aliases: [],
  });
  const location = await createEntity("novel-1", {
    type: "location",
    name: "TestGenericLocation",
    aliases: [],
    description: "",
  });
  const chapter = await createChapter("novel-1", "vol-1", {
    number: 1,
    title: "One",
  });

  await updateChapter("novel-1", "vol-1", chapter.id, {
    notes: [
      {
        id: "note-1",
        content:
          "[[TestGenericCharacter]] traveled to [[location:TestGenericLocation]].",
        created_at: "2026-09-11T00:00:00.000Z",
        updated_at: "2026-09-11T00:00:00.000Z",
      },
    ],
  });

  const fetched = await getChapter("novel-1", "vol-1", chapter.id);
  expect(fetched.notes[0].references).toHaveLength(2);
  expect(fetched.notes[0].references?.map((r) => r.token.status)).toEqual([
    "resolved",
    "resolved",
  ]);
  // Legacy fields only ever reflect the character subset — the location reference must not leak in.
  expect(fetched.characters.map((c) => c.id)).toEqual([character.id]);
  expect(fetched.characters.map((c) => c.id)).not.toContain(location.id);
});

it("leaves an unresolved generic reference searchable as text without creating an entity", async () => {
  await seedVolume("novel-1", "vol-1");
  const chapter = await createChapter("novel-1", "vol-1", {
    number: 1,
    title: "One",
  });

  await updateChapter("novel-1", "vol-1", chapter.id, {
    notes: [
      {
        id: "note-1",
        content: "[[item:Unnamed Blade]] gleamed.",
        created_at: "2026-09-11T00:00:00.000Z",
        updated_at: "2026-09-11T00:00:00.000Z",
      },
    ],
  });

  const fetched = await getChapter("novel-1", "vol-1", chapter.id);
  expect(fetched.notes[0].references?.[0].token).toMatchObject({
    status: "unresolved",
    typed: "item",
    label: "Unnamed Blade",
  });
  expect(await getEntities("novel-1", "item")).toHaveLength(0);
});
```

Add the needed imports at the top of `libs/firebase/chapters.test.ts`: `createEntity, getEntities` from `./entities`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- libs/firebase/chapters.test.ts`
Expected: FAIL — `fetched.notes[0].references` is `undefined`.

- [ ] **Step 3: Add the generic `EntityLookup` implementation backed by Firestore**

Add to `libs/firebase/chapters.ts` (new private helper, placed after the existing imports):

```ts
import { getEntities } from "./entities";
import { buildEntityId } from "@/libs/entities/keys";
import {
  reconcileReferenceOccurrences,
  type PreviousReferenceState,
} from "@/libs/entities/reconcile";
import type { ReferenceOccurrence } from "@/libs/entities/references";
import type { EntityLookup } from "@/libs/entities/references";
import type { Entity, EntityType } from "@/libs/entities/types";

function firestoreEntityLookup(novelId: string): EntityLookup {
  return {
    async findByName(scopedNovelId, name, type) {
      const needle = name.trim().toLocaleLowerCase();
      if (type === "character" || type === undefined) {
        const characters = await getCharactersByNames(scopedNovelId, [name]);
        const characterMatches: Entity[] = characters
          .filter(
            (c) =>
              c.name.toLocaleLowerCase() === needle ||
              c.aliases.some((a) => a.toLocaleLowerCase() === needle),
          )
          .map((c) => ({
            id: buildEntityId(scopedNovelId, "character", c.id),
            novelId: scopedNovelId,
            type: "character" as const,
            name: c.name,
            aliases: c.aliases,
            description: c.description,
          }));
        if (type === "character") return characterMatches;
      }
      if (type === undefined) return []; // untyped syntax only ever resolves against "character" — see Task 3.
      const generic = await getEntities(
        scopedNovelId,
        type as Exclude<EntityType, "character">,
      );
      return generic.filter(
        (e) =>
          e.name.toLocaleLowerCase() === needle ||
          e.aliases.some((a) => a.toLocaleLowerCase() === needle),
      );
    },
  };
}
```

- [ ] **Step 4: Extend `ChapterNoteDoc`/`ChapterNote` and thread `references` through create/update**

In `app/types.ts`, extend `ChapterNote` (line 81-88):

```ts
export interface ChapterNote {
  id: string;
  content: string;
  character_ids?: string[];
  mentioned_character_names?: string[];
  references?: ReferenceOccurrence[];
  created_at: string;
  updated_at: string;
}
```

Add the import at the top of `app/types.ts`: `import type { ReferenceOccurrence } from "@/libs/entities/references"`.

In `libs/firebase/chapters.ts`, extend `ChapterNoteDoc` (line 70-77) with `references?: ReferenceOccurrenceDoc[]` (a Firestore-serializable form — `ReferenceOccurrence` is already plain JSON-safe data, so `ReferenceOccurrenceDoc = ReferenceOccurrence`, no separate type needed; reuse it directly).

Replace `hydrateLegacyNoteRelations` and `resolveChangedNoteRelations` (lines 137-173) with generic equivalents that call the reconciler instead of `extractMentions`:

```ts
async function hydrateNoteReferences(
  novelId: string,
  notes: ChapterNoteDoc[],
): Promise<ChapterNoteDoc[]> {
  const lookup = firestoreEntityLookup(novelId);
  const stale = notes.filter((note) => note.references === undefined);
  if (stale.length === 0) return notes;
  const hydrated = await Promise.all(
    stale.map(async (note) => ({
      ...note,
      references: await reconcileReferenceOccurrences(
        novelId,
        note.content,
        note.character_ids !== undefined
          ? {
              content: note.content,
              occurrences: legacyCharacterFieldsToOccurrences(note),
            }
          : null,
        lookup,
      ),
    })),
  );
  const hydratedById = new Map(hydrated.map((note) => [note.id, note]));
  return notes.map((note) => hydratedById.get(note.id) ?? note);
}

// Bridges a pre-migration note (character_ids/mentioned_character_names only, no
// references[]) into occurrence shape so reconciliation treats it as "already resolved"
// instead of re-running lookups against every character on first read after this ships.
function legacyCharacterFieldsToOccurrences(
  note: ChapterNoteDoc,
): ReferenceOccurrence[] {
  const names = note.mentioned_character_names ?? [];
  const idByName = new Map<string, string>(); // populated by the one-off backfill script (Task 6); empty here is safe — falls back to unresolved.
  return names.map((name) => ({
    start: 0,
    length: 0,
    raw: `[[${name}]]`,
    token: idByName.has(name)
      ? {
          status: "resolved" as const,
          reference: {
            entityId: idByName.get(name)!,
            entityType: "character" as const,
            label: name,
          },
        }
      : { status: "unresolved" as const, typed: null, label: name },
  }));
}

async function resolveChangedNoteReferences(
  novelId: string,
  notes: ChapterNote[],
  previousById: Map<string, ChapterNoteDoc>,
): Promise<ChapterNote[]> {
  const lookup = firestoreEntityLookup(novelId);
  return Promise.all(
    notes.map(async (note) => {
      const previous = previousById.get(note.id);
      const references = await reconcileReferenceOccurrences(
        novelId,
        note.content,
        previous
          ? {
              content: previous.content,
              occurrences: previous.references ?? [],
            }
          : null,
        lookup,
      );
      return { ...note, references };
    }),
  );
}

// Derives the legacy character-only projection from the character subset of references —
// the ONLY place character_ids/mentioned_character_names are computed from now on.
function legacyCharacterFields(references: ReferenceOccurrence[]): {
  character_ids: string[];
  mentioned_character_names: string[];
} {
  const ids = new Set<string>(),
    names = new Set<string>();
  references.forEach(({ token }) => {
    if (
      token.status === "resolved" &&
      token.reference.entityType === "character"
    ) {
      ids.add(token.reference.entityId.split(":").slice(2).join(":")); // strip back to the raw character doc id
      names.add(token.reference.label);
    } else if (
      (token.status === "unresolved" || token.status === "ambiguous") &&
      (token.typed === null || token.typed === "character")
    ) {
      names.add(token.label);
    }
  });
  return { character_ids: [...ids], mentioned_character_names: [...names] };
}
```

Update `notesForChapter` (line 79-85) to also surface `references` on the read path:

```ts
function notesForChapter(data: ChapterDoc): ChapterNote[] {
  if (data.notes)
    return data.notes
      .map((note) => ({
        id: note.id,
        content: note.content,
        references: note.references,
        created_at: tsToIso(note.created_at),
        updated_at: tsToIso(note.updated_at),
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!data.summary) return [];
  return [
    {
      id: "legacy-summary",
      content: data.summary,
      references: [],
      created_at: tsToIso(data.created_at),
      updated_at: tsToIso(data.updated_at),
    },
  ];
}
```

Update `notesToDoc` (line 87-91) to persist `references`:

```ts
function notesToDoc(notes: ChapterNote[]): ChapterNoteDoc[] {
  return [...notes]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((note) => ({
      id: note.id,
      content: note.content,
      references: note.references ?? [],
      created_at: Timestamp.fromDate(new Date(note.created_at)),
      updated_at: Timestamp.fromDate(new Date(note.updated_at)),
    }));
}
```

In `updateChapter` (line 319-408), replace the `hydrateLegacyNoteRelations`/`resolveChangedNoteRelations`/count-map block (lines 339-377) with:

```ts
const previousNotes = await hydrateNoteReferences(novelId, data.notes ?? []);
const previousById = new Map(previousNotes.map((note) => [note.id, note]));
const notes = await resolveChangedNoteReferences(
  novelId,
  payload.notes,
  previousById,
);

const allReferences = notes.flatMap((note) => note.references ?? []);
const { character_ids, mentioned_character_names } =
  legacyCharacterFields(allReferences);

update.notes = notesToDoc(notes);
update.character_ids = character_ids;
update.mentioned_character_names = mentioned_character_names;
```

This drops `character_mention_counts`/`mentioned_character_name_counts` entirely — they existed only to let the old per-note diffing incrementally add/remove counts across saves; deriving the whole legacy projection fresh from `notes.flatMap(...)` on every save is simpler, still correct, and matches how `getChaptersFlat`/`getChapter` already recompute derived data from the full document on every read. Remove the two count fields from `ChapterDoc` (lines 39-41) and from `createChapter`'s initial doc (lines 296-299 `character_mention_counts: {}`, `mentioned_character_name_counts: {}`).

In `getChapter` (line 227-245), replace the `mentioned_character_names` fallback line (239) — it no longer needs the `extractMentions` fallback since `references` is now always populated by `hydrateNoteReferences` on read:

```ts
export async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<ChapterWithCharacters> {
  const snapshot = await getDoc(chapterRef(novelId, volumeId, chapterId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  const data = snapshot.data() as ChapterDoc;
  const tags = await tagsForChapter(novelId, data.tag_ids ?? []);
  const hydratedNotes = await hydrateNoteReferences(novelId, data.notes ?? []);
  const chapter = toChapter(
    snapshot.id,
    { ...data, notes: hydratedNotes },
    tags,
  );
  const allReferences = chapter.notes.flatMap((note) => note.references ?? []);
  const mentioned_character_names =
    legacyCharacterFields(allReferences).mentioned_character_names;
  const characters =
    (data.character_ids ?? []).length === 0
      ? []
      : await getCharactersByIds(novelId, data.character_ids ?? []).catch(
          () => [],
        );
  return { ...chapter, characters, mentioned_character_names };
}
```

Delete the now-unused `extractMentions` import (line 22) and the `incrementCounts` helper (lines 175-181) — both are dead once this task lands. Keep `libs/firebase/mentions.ts`'s `extractMentions` export itself for now; Task 6's backfill script still needs it to read _pre-migration_ content.

- [ ] **Step 5: Run the chapters tests to verify they pass**

Run: `corepack pnpm test -- libs/firebase/chapters.test.ts`
Expected: PASS, including the two new generic-reference tests. Existing tests (`"links a mentioned character's id into character_ids on chapter update"`, `"links mentions from all notes and does not unlink a character after a note is removed"`, etc.) must still pass unmodified — they exercise the exact legacy-compatibility guarantee this task must preserve.

- [ ] **Step 6: Extend `NovelEvent`/`libs/firebase/events.ts` for description references**

In `app/types.ts`, add `description_references?: ReferenceOccurrence[]` to `NovelEvent` (line 90-106).

In `libs/firebase/events.ts`, add `description_references?: ReferenceOccurrence[]` to `EventDoc` (line 19-32), and in `createEvent`/`updateEvent` resolve description references the same way chapters do — using `resolveReferenceOccurrences`/`reconcileReferenceOccurrences` against `firestoreEntityLookup` (extract that helper from `libs/firebase/chapters.ts` into a shared, exported function first — move `firestoreEntityLookup` from Step 3 into `libs/entities/firestoreLookup.ts` so both `chapters.ts` and `events.ts` import the same implementation instead of duplicating it):

```ts
// libs/entities/firestoreLookup.ts
import { getEntities } from "@/libs/firebase/entities";
import { getCharactersByNames } from "@/libs/firebase/characters";
import { buildEntityId } from "./keys";
import type { EntityLookup } from "./references";
import type { Entity, EntityType } from "./types";

export function firestoreEntityLookup(novelId: string): EntityLookup {
  return {
    async findByName(scopedNovelId, name, type) {
      const needle = name.trim().toLocaleLowerCase();
      if (type === "character" || type === undefined) {
        const characters = await getCharactersByNames(scopedNovelId, [name]);
        const characterMatches: Entity[] = characters
          .filter(
            (c) =>
              c.name.toLocaleLowerCase() === needle ||
              c.aliases.some((a) => a.toLocaleLowerCase() === needle),
          )
          .map((c) => ({
            id: buildEntityId(scopedNovelId, "character", c.id),
            novelId: scopedNovelId,
            type: "character" as const,
            name: c.name,
            aliases: c.aliases,
            description: c.description,
          }));
        if (type === "character") return characterMatches;
        if (type === undefined) return [];
      }
      const generic = await getEntities(
        scopedNovelId,
        type as Exclude<EntityType, "character">,
      );
      return generic.filter(
        (e) =>
          e.name.toLocaleLowerCase() === needle ||
          e.aliases.some((a) => a.toLocaleLowerCase() === needle),
      );
    },
  };
}
```

Update `libs/firebase/chapters.ts` Step 3 to `import { firestoreEntityLookup } from "@/libs/entities/firestoreLookup";` instead of defining it locally.

In `createEvent` (line 131-153), add `description_references: payload.description ? await resolveReferenceOccurrences(novelId, payload.description, firestoreEntityLookup(novelId)) : []` to the `withCreateTimestamps({...})` object. In `updateEvent` (line 155-180), when `payload.description !== undefined`, fetch the current doc's `description`/`description_references` first and call `reconcileReferenceOccurrences` the same way `updateChapter` does, storing the result as `update.description_references`.

- [ ] **Step 7: Write the failing test for event description references**

Add to `libs/firebase/events.test.ts` (check the file for its existing emulator setup pattern first — it follows the same `useEmulator`/`clearFirestoreEmulator` shape as `chapters.test.ts`):

```ts
it("resolves generic references in an event's description", async () => {
  const character = await createCharacter("novel-1", {
    name: "TestEventCharacter",
    role: "minor",
    description: "",
    aliases: [],
  });
  const event = await createEvent("novel-1", {
    title: "Arrival",
    description: "[[TestEventCharacter]] arrives.",
  });
  expect(event.description_references).toHaveLength(1);
  expect(event.description_references?.[0].token).toMatchObject({
    status: "resolved",
    reference: { entityType: "character" },
  });
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `corepack pnpm test -- libs/firebase/events.test.ts libs/firebase/chapters.test.ts`
Expected: PASS.

- [ ] **Step 9: Type-check, lint, and full suite**

Run: `corepack pnpm build && corepack pnpm lint && corepack pnpm test`
Expected: no errors; the full suite (including every pre-existing `libs/firebase/*.test.ts`) still passes.

- [ ] **Step 10: Commit**

```bash
git add libs/firebase/chapters.ts libs/firebase/chapters.test.ts libs/firebase/events.ts libs/firebase/events.test.ts libs/entities/firestoreLookup.ts app/types.ts
git commit -m "$(cat <<'EOF'
feat(entities): resolve generic references in chapter notes and event descriptions

Legacy character_ids/mentioned_character_names now derive from the character
subset of the new reference occurrences instead of a separate mention parser,
so existing character filters/counts/UI keep working unchanged.

EOF
)"
```

---

### Task 6: Idempotent legacy backfill and round-trip verification

**Files:**

- Create: `scripts/one-off/backfill-entity-references.ts`
- Modify: `package.json` (new `backfill:entity-references` script)
- Modify: `libs/firebase/chapters.test.ts` (round-trip test)

**Interfaces:**

- Consumes: `firebase-admin/firestore`, `extractMentions` from `libs/firebase/mentions.ts`, the entity/reference types from Task 2-4.
- Produces: a one-off maintenance script; no new runtime exports.

Existing production chapters (per `docs/_complete_logs.md`'s Plan 4 migration record) predate `references[]` entirely — they only have `character_ids`/`mentioned_character_names`. Task 5's `hydrateNoteReferences` already hydrates these lazily on read (Step 4's `legacyCharacterFieldsToOccurrences` bridge), but that bridge only ever produces `resolved`/`unresolved` character references from names it can't map back to IDs reliably post-hoc for notes that were never re-saved. This script proactively backfills every existing note/event with real `references[]`, computed the same way the live resolver would, so reads don't pay a lazy-hydration cost forever and so `mentioned_character_names` that map to a specific character ID become `resolved` (not `unresolved`) immediately.

- [ ] **Step 1: Write the script**

Create `scripts/one-off/backfill-entity-references.ts`, following the exact structure of `scripts/one-off/backfill-chapter-notes.ts` (Firebase Admin init, iterate every novel/volume/chapter, idempotent — checking `references !== undefined` before writing so a re-run is a no-op):

```ts
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { extractReferenceTokens } from "@/libs/entities/references";

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LegacyNote {
  id: string;
  content: string;
  character_ids?: string[];
  mentioned_character_names?: string[];
  references?: unknown;
  created_at: FirebaseFirestore.Timestamp;
  updated_at: FirebaseFirestore.Timestamp;
}

async function resolveCharacterByName(
  novelId: string,
  name: string,
): Promise<string | null> {
  const needle = name.trim().toLocaleLowerCase();
  const snapshot = await db
    .collection("novels")
    .doc(novelId)
    .collection("characters")
    .get();
  const matches = snapshot.docs.filter((doc) => {
    const data = doc.data() as { name: string; aliases?: string[] };
    return (
      data.name.toLocaleLowerCase() === needle ||
      (data.aliases ?? []).some((a) => a.toLocaleLowerCase() === needle)
    );
  });
  return matches.length === 1 ? matches[0].id : null; // leave ambiguous/unknown as unresolved — never guess.
}

async function backfillNote(novelId: string, note: LegacyNote) {
  if (note.references !== undefined) return null; // idempotent: already backfilled.
  const tokens = extractReferenceTokens(note.content);
  const references = await Promise.all(
    tokens.map(async (token) => {
      if (token.typed !== null && token.typed !== "character") {
        return {
          start: token.start,
          length: token.length,
          raw: token.raw,
          token: {
            status: "unresolved" as const,
            typed: token.typed,
            label: token.label,
          },
        };
      }
      const characterId = await resolveCharacterByName(novelId, token.label);
      return {
        start: token.start,
        length: token.length,
        raw: token.raw,
        token: characterId
          ? {
              status: "resolved" as const,
              reference: {
                entityId: `${novelId}:character:${characterId}`,
                entityType: "character" as const,
                label: token.label,
              },
            }
          : { status: "unresolved" as const, typed: null, label: token.label },
      };
    }),
  );
  return references;
}

async function main() {
  const novels = await db.collection("novels").listDocuments();
  let notesBackfilled = 0,
    eventsBackfilled = 0;

  for (const novelRef of novels) {
    const volumes = await novelRef.collection("volumes").listDocuments();
    for (const volumeRef of volumes) {
      const chapters = await volumeRef.collection("chapters").get();
      for (const chapterDoc of chapters.docs) {
        const data = chapterDoc.data() as { notes?: LegacyNote[] };
        if (!data.notes?.length) continue;
        const updatedNotes = await Promise.all(
          data.notes.map(async (note) => {
            const references = await backfillNote(novelRef.id, note);
            if (references === null) return note;
            notesBackfilled += 1;
            return { ...note, references };
          }),
        );
        await chapterDoc.ref.update({ notes: updatedNotes });
      }
    }

    const events = await novelRef.collection("events").get();
    for (const eventDoc of events.docs) {
      const data = eventDoc.data() as {
        description?: string;
        description_references?: unknown;
      };
      if (data.description_references !== undefined || !data.description)
        continue;
      const references = await backfillNote(novelRef.id, {
        id: eventDoc.id,
        content: data.description,
        created_at: eventDoc.createTime!,
        updated_at: eventDoc.updateTime!,
      });
      await eventDoc.ref.update({ description_references: references ?? [] });
      eventsBackfilled += 1;
    }
  }

  console.log(
    `Backfilled references on ${notesBackfilled} notes and ${eventsBackfilled} events.`,
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

In `package.json`, add next to `backfill:chapter-entry-order`:

```json
    "backfill:entity-references": "tsx --env-file=.env.local scripts/one-off/backfill-entity-references.ts"
```

- [ ] **Step 3: Add a round-trip verification test**

Add to `libs/firebase/chapters.test.ts`:

```ts
it("round-trips references through save/load unchanged when nothing edits the content", async () => {
  await seedVolume("novel-1", "vol-1");
  await createCharacter("novel-1", {
    name: "RoundTripCharacter",
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
        content: "[[RoundTripCharacter]] returns.",
        created_at: "2026-09-11T00:00:00.000Z",
        updated_at: "2026-09-11T00:00:00.000Z",
      },
    ],
  });

  const firstRead = await getChapter("novel-1", "vol-1", chapter.id);
  const secondRead = await getChapter("novel-1", "vol-1", chapter.id);
  expect(secondRead.notes[0].references).toEqual(firstRead.notes[0].references);
});
```

- [ ] **Step 4: Run the tests**

Run: `corepack pnpm test -- libs/firebase/chapters.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors. (`scripts/one-off/*.ts` are excluded from the Next.js app bundle but still type-checked by `tsc`/`next build` per `tsconfig.json`'s `**/*.ts` include — fix any type errors surfaced there.)

- [ ] **Step 6: Commit**

```bash
git add scripts/one-off/backfill-entity-references.ts package.json libs/firebase/chapters.test.ts
git commit -m "$(cat <<'EOF'
feat(entities): add idempotent backfill for legacy chapter/event references

EOF
)"
```

---

### Task 7: Minimal generic entity management UI

**Files:**

- Create: `app/novels/[id]/entities/page.tsx`
- Create: `app/novels/[id]/entities/EntityList.tsx`
- Create: `app/novels/[id]/entities/[entityId]/page.tsx`
- Create: `app/novels/[id]/entities/[entityId]/EntityDetail.tsx`
- Modify: `locales/en.ts`, `locales/th.ts`
- Modify: `components/commands/CommandPalette.tsx` (add an `entities` navigation command, mirroring the existing `characters`/`timeline` entries at line 65)

**Interfaces:**

- Consumes: `getEntities`, `getEntity`, `createEntity`, `updateEntity`, `deleteEntity` from `@/libs/api` (Task 2).

Per spec Section 4: "A shared entity detail view is sufficient; six bespoke management systems are unnecessary." This task builds exactly one list page (grouped by type, since `getEntities(novelId, type?)` already supports filtering) and one detail page, reusing `app/novels/ui.tsx`'s `DashboardPage`/`cardClassName`/`ConfirmDialog`/`Snackbar` and the exact create/edit/delete interaction pattern already shipped in `app/novels/[id]/characters/CharacterList.tsx` and `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx` — read both of those files before writing this task's components, since this plan does not reproduce their full JSX (only the parts that differ: a `type` selector for create, since entities span five types where characters only have one).

- [ ] **Step 1: List page**

`app/novels/[id]/entities/page.tsx` (server component): fetch `getEntities(novelId)` (all five types, unfiltered) and `getNovel(novelId)`, pass to `EntityList`, following `app/novels/[id]/characters/page.tsx`'s exact server-component shape (no pagination needed yet — five entity types with a handful of entries each does not need `PaginationMeta`; add it later if `docs/engineering/PROGRESS.md` gains an item for it, per this repo's "don't build ahead of a tracked need" convention).

`EntityList.tsx` (client component): group entities by `type` into five sections (one per `GENERIC_ENTITY_TYPES` value), each with a name/alias list linking to `/novels/{novelId}/entities/{entityId}`, and an inline "add" form per section using `createEntity(novelId, { type, name, aliases: [], description: "" })` — mirror `CharacterList.tsx`'s add-row pattern exactly, with `type` fixed per section instead of user-selectable.

- [ ] **Step 2: Detail page**

`app/novels/[id]/entities/[entityId]/page.tsx` (server component): `getEntity(novelId, entityId)`, 404 via `notFound()` on failure (mirror `app/novels/[id]/characters/[characterId]/page.tsx`).

`EntityDetail.tsx` (client component): inline-editable name/aliases/description, `ConfirmDialog` + `deleteEntity` for deletion, `Snackbar` for save feedback — mirror `CharacterDetail.tsx`'s editing pattern (`editing` boolean toggle, per-field controlled inputs, single "Save"/"Cancel" pair rather than per-field save buttons, since entities have only three simple fields).

- [ ] **Step 3: Locale keys**

Add an `entity.*` block to `locales/en.ts`/`locales/th.ts` mirroring the existing `character.*`/`addCharacter.*` blocks' key names (`entity.eyebrow`, `entity.title`, `entity.nameRequired`, `entity.aliases`, `entity.saveSuccess`, `entity.deleteConfirmTitle`, `entity.deleteSuccess`, `entity.notFound`, and one label per type: `entity.type.location`, `entity.type.skill`, `entity.type.organization`, `entity.type.item`, `entity.type.concept`) — copy the exact English/Thai phrasing style already used for `character.*` keys (e.g. `"character.deleteSuccess": "Character deleted successfully."` → `"entity.deleteSuccess": "Entity deleted successfully."`).

- [ ] **Step 4: Command palette navigation entry**

In `components/commands/CommandPalette.tsx`, add to the `navigationCommands` array (line 65), inside the `novelId ? [...]` block, after the `characters` entry:

```tsx
{ id: 'entities', label: t('command.entities'), hint: t('command.entitiesHint'), href: `/novels/${novelId}/entities`, keywords: 'entities locations skills organizations items concepts เอนทิตี' },
```

Add `command.entities`/`command.entitiesHint` to both locale files next to the existing `command.characters`/`command.charactersHint` keys.

- [ ] **Step 5: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

With `make firebase-emulators` and `corepack pnpm dev` running: open a novel, use Ctrl/Cmd+Shift+K → "Entities" (or navigate directly to `/novels/{id}/entities`), create one entity of each of the five types, open its detail page, edit its name/aliases/description, delete one. Confirm `[[location:...]]`-style references now resolve against these entities from a chapter note (Task 5).

- [ ] **Step 6: Commit**

```bash
git add "app/novels/[id]/entities" components/commands/CommandPalette.tsx locales/en.ts locales/th.ts
git commit -m "$(cat <<'EOF'
feat(entities): add minimal list/detail UI for the five generic entity types

EOF
)"
```

---

## Verification Against the Spec

This plan satisfies spec Section 15 acceptance criteria: "Untyped `[[Rimuru Tempest]]` still resolves as character" (Task 3), "Equal names across types/novels do not cross-resolve; ambiguity never silently picks a target" (Task 3), "Renames and unrelated text edits preserve bindings" (Task 4), "Legacy structured character relationships survive hydration/backfill" (Task 5, Task 6), "Generic references survive Firestore save/load" (Task 6's round-trip test).

Deferred to Plan 2/3: the `SearchDocument` projection of these references, `SearchIndexProvider`, and command-palette search UI — this plan only makes references resolvable and persisted; it does not yet make them searchable beyond what already exists in `CommandPalette.tsx` today.
