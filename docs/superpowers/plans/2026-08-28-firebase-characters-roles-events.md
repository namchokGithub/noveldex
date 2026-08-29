# Firebase Characters, Character Roles & Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `characters`, `character_roles`, and `events` off the Go API onto direct Firestore client SDK calls — the third slice of the Firebase migration, completing every domain except the data migration script and repo cutover (a later Plan 4). This plan also removes the temporary Go-API hybrid Plan 2 added for `[[Name]]` mention auto-link, and fixes the timeline page, which currently reads chapters from Postgres and has been broken since Plan 2 moved chapters to Firestore.

**Architecture:** Same shape as Plans 1-2. `apps/web` keeps its Server Component (reads) + Client Component (writes) structure. New Firestore modules follow the established pattern (`libs/firebase/{characterRoles,characters,events}.ts`, collection-ref helper + `toX()` mapper + `db`/`tsToIso`/`withCreateTimestamps`/`withUpdateTimestamp` from Plan 1's foundation). After this plan, `apps/web/libs/api/index.ts` has **zero** remaining Go-API-backed functions — the Go API stays running (Plan 4 retires it), but nothing in the web app calls it anymore.

**Tech Stack:** Same as Plans 1-2 — Firebase JS SDK v11, Firebase Local Emulator Suite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-firebase-migration-design.md` and the two prior plans (`docs/superpowers/plans/2026-08-28-firebase-foundation-and-novels.md`, `docs/superpowers/plans/2026-08-28-firebase-volumes-chapters-tags.md`) — this plan reuses every established pattern from both: snake_case fields, the shared helpers, the emulator test harness, the `"Request failed."` not-found contract, the `libs/api/index.ts` re-export pattern, and the `where('name','in',names)` mention-resolution pattern chapters already use for tags.

## Global Constraints

- Firestore document fields use **snake_case** — same as Plans 1-2.
- No Cloud Functions, no Server Actions, no Admin SDK — only the `firebase` client package.
- Firestore security rules stay fully open — unchanged.
- **Data model for this plan:**
  ```
  character_roles/{roleId}          -- root collection, GLOBAL (not novel-scoped) — confirmed
    - code, name, is_active            against the Go schema: no novel_id column anywhere.
                                        Read-only master data from the web's perspective —
                                        no create/update/delete functions, matching the Go
                                        API (which has none either; roles are seeded once).

  novels/{novelId}/characters/{characterId}
    - name, aliases: string[]
    - role_id, role, role_name         -- role_id + role(code) + role_name always written
                                           together (mutual-exclusivity resolution, see Task 2)
    - profile_image_url: string | null
    - description
    - created_at, updated_at
    -- chapter_count / chapters[] are NOT stored — computed at read time via
       collectionGroup('chapters').where('character_ids','array-contains',characterId)

  novels/{novelId}/events/{eventId}
    - title, description, story_date, sort_order
    - chapter_id: string | null
    - chapter_volume_id, chapter_title, chapter_number   -- denormalized, recomputed on
                                                             every write where chapter_id
                                                             is set (see Task 3)
    - character_ids: string[]          -- mirrors chapters' character_ids; no write path
                                           populates it yet (no link/unlink UI exists for
                                           events today, confirmed — same "field exists,
                                           nothing writes to it yet" state chapters'
                                           character_ids was in before Plan 2's Task 5).
                                           character_names for display are resolved from
                                           this array at read time, same pattern as chapter
                                           tag/character hydration.
    - created_at, updated_at
  ```
- **`chapter_volume_id` is required alongside `chapter_id` on event create/update, not looked up.** Firestore chapters live at `novels/{novelId}/volumes/{volumeId}/chapters/{chapterId}` — knowing only `chapter_id` (what the Go API's event schema stores) isn't enough to build the document path, and there's no cheap way to find a chapter by ID alone across a novel's volumes without an expensive collection-group scan. The timeline UI already fetches the novel's full flat chapter list (via this plan's new `getChaptersFlat`, itself a `ChapterSummary[]` which already carries `volume_id`) to populate its chapter picker — so the caller already has `volume_id` in hand when it submits an event. `createEvent`/`updateEvent` accept both `chapter_id` and `chapter_volume_id` together; when `chapter_id` is set, the volume-qualified path is used for a direct, cheap `getDoc` to read the chapter's `title`/`number` for denormalization.
- **Character delete does NOT cascade to `character_ids` arrays on chapters/events.** Postgres likely cascades this via FK constraints, but there is no character-delete UI anywhere in the current app (confirmed) — this is unreachable code today. Building the cascade (a `collectionGroup` scan + batched `arrayRemove` across every referencing chapter, plus a per-event scan) for a path nothing can trigger is over-engineering for this plan. If delete UI is added later, add the cascade then.
- **`getAllCharacters(novelId)`** (Task 2) is a new, deliberately unpaginated helper — every "legacy array, no params" bypass call site this plan fixes (mention-link name resolution, the novel-detail-page character count, event `character_names` resolution) needs the same shape `getTags`/`getCharacterRoles` already have. The existing paginated `getCharacters(novelId, {page,perPage})` is untouched — it always was and remains paginated-only; the Go API's dual-mode (`no params → array`) behavior is reproduced by having two separate functions, not one function with two return shapes.
- **New Firestore indexes needed in this plan** (added incrementally, in the task that first needs them):
  - `chapters` collection group, `character_ids` (array-contains) + `number` (ascending) — for a character's `chapters: ChapterSummary[]` list, ordered by chapter number (Task 2).
  - `chapters` collection group, `novel_id` (ascending) + `number` (ascending) — for `getChaptersFlat`, the novel-wide chapter list the timeline page needs (Task 4). The existing `novel_id`+`read_at` composite index does not serve this (different second field).
  - The existing `fieldOverride` enabling `COLLECTION_GROUP` scope on `chapters.novel_id` (from Plan 2) already covers the equality half of both new queries; array-contains fields get collection-group scope automatically in Firestore's automatic indexing (unlike plain equality fields), so no additional `fieldOverride` entry is needed for `character_ids`.
  - **Same emulator/production gap as Plan 2:** the local emulator does not enforce these — they're right by careful construction, not by an automated check.
- **This plan's temporary-hybrid removal (Task 4) is the intended cleanup of Plan 2's documented stopgap** — `fetchNovelCharacters`, `MinimalCharacter`, and the `apiClient` import all get deleted from `chapters.ts`, replaced with direct Firestore queries using this plan's `characters.ts`.

---

## Task 1: Character roles via Firestore (global, read-only)

**Files:**
- Create: `apps/web/libs/firebase/characterRoles.ts`
- Create: `apps/web/libs/firebase/characterRoles.test.ts`
- Modify: `apps/web/libs/api/index.ts` (replace `getCharacterRoles` body with a re-export)

**Interfaces:**
- Consumes: `db` (from `./app`).
- Produces: `getCharacterRoles(): Promise<CharacterRole[]>`.

- [ ] **Step 1: Write the failing tests**

`apps/web/libs/firebase/characterRoles.test.ts`:

```ts
import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { getCharacterRoles } from "./characterRoles";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("getCharacterRoles", () => {
  it("returns only active roles, ordered by name", async () => {
    await setDoc(doc(db, "character_roles", "r1"), {
      code: "protagonist",
      name: "Protagonist",
      is_active: true,
    });
    await setDoc(doc(db, "character_roles", "r2"), {
      code: "antagonist",
      name: "Antagonist",
      is_active: true,
    });
    await setDoc(doc(db, "character_roles", "r3"), {
      code: "retired",
      name: "Retired Role",
      is_active: false,
    });

    const roles = await getCharacterRoles();

    expect(roles.map((r) => r.name)).toEqual(["Antagonist", "Protagonist"]);
    expect(roles.every((r) => r.is_active)).toBe(true);
  });

  it("returns an empty array when no roles exist", async () => {
    expect(await getCharacterRoles()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (with the emulator running via `make firebase-emulators`): `cd apps/web && pnpm test characterRoles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`apps/web/libs/firebase/characterRoles.ts`:

```ts
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import type { CharacterRole } from "@/app/types";
import { db } from "./app";

interface CharacterRoleDoc {
  code: string;
  name: string;
  is_active: boolean;
}

function toCharacterRole(id: string, data: CharacterRoleDoc): CharacterRole {
  return { id, code: data.code, name: data.name, is_active: data.is_active };
}

export async function getCharacterRoles(): Promise<CharacterRole[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "character_roles"),
      where("is_active", "==", true),
      orderBy("name"),
    ),
  );
  return snapshot.docs.map((d) => toCharacterRole(d.id, d.data() as CharacterRoleDoc));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test characterRoles.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into `libs/api/index.ts`**

In `apps/web/libs/api/index.ts`, delete the existing `getCharacterRoles` function body and add to the Firestore re-export block:

```ts
export { getCharacterRoles } from "@/libs/firebase/characterRoles";
```

Leave `getCharacters` (still Go-backed — this task doesn't touch it, Task 2 does) untouched.

- [ ] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass; `tsc` shows only the pre-existing, unrelated `NovelCover.tsx` error.

- [ ] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/characterRoles.ts apps/web/libs/firebase/characterRoles.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate character roles from Go API to Firestore"
```

---

## Task 2: Characters domain via Firestore

**Files:**
- Create: `apps/web/libs/firebase/characters.ts`
- Create: `apps/web/libs/firebase/characters.test.ts`
- Modify: `apps/web/firestore.indexes.json`
- Modify: `apps/web/libs/api/index.ts` (replace `getCharacters` body with a re-export; add new exports)

**Interfaces:**
- Consumes: `db`, `tsToIso`, `withCreateTimestamps`, `withUpdateTimestamp` (Plan 1 helpers), `getCharacterRoles` (from `./characterRoles`, Task 1) for role-code resolution.
- Produces: `getCharacters(novelId, {page?, perPage?}): Promise<PaginatedCharacters>`, `getAllCharacters(novelId): Promise<Character[]>`, `getCharacter(novelId, characterId): Promise<Character>`, `createCharacter(novelId, payload: CharacterCreatePayload): Promise<Character>`, `updateCharacter(novelId, characterId, payload: CharacterUpdatePayload): Promise<Character>`, `deleteCharacter(novelId, characterId): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`apps/web/libs/firebase/characters.test.ts`:

```ts
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createCharacter,
  deleteCharacter,
  getAllCharacters,
  getCharacter,
  getCharacters,
  updateCharacter,
} from "./characters";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
  await setDoc(doc(db, "character_roles", "role-protagonist"), {
    code: "protagonist",
    name: "Protagonist",
    is_active: true,
  });
  await setDoc(doc(db, "character_roles", "role-minor"), {
    code: "minor",
    name: "Minor",
    is_active: true,
  });
});

async function seedChapterWithCharacter(
  novelId: string,
  chapterId: string,
  number: number,
  characterId: string,
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", "vol-1", "chapters", chapterId),
    {
      number,
      title: `Chapter ${number}`,
      summary: "",
      read_at: null,
      novel_id: novelId,
      volume_id: "vol-1",
      tag_ids: [],
      character_ids: [characterId],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    },
  );
}

describe("characters", () => {
  it("creates a character resolving role_id to role/role_name", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role_id: "role-protagonist",
      description: "",
      aliases: [],
    });

    expect(character.name).toBe("Alice");
    expect(character.role_id).toBe("role-protagonist");
    expect(character.role).toBe("protagonist");
    expect(character.role_name).toBe("Protagonist");
    expect(character.aliases).toEqual([]);
    expect(character.chapter_count).toBe(0);
  });

  it("creates a character resolving a role code to role_id/role_name", async () => {
    const character = await createCharacter("novel-1", {
      name: "Bob",
      role: "minor",
      description: "",
      aliases: [],
    });

    expect(character.role_id).toBe("role-minor");
    expect(character.role).toBe("minor");
    expect(character.role_name).toBe("Minor");
  });

  it("updating role_id clears the old role code resolution and re-resolves", async () => {
    const character = await createCharacter("novel-1", {
      name: "Carol",
      role: "minor",
      description: "",
      aliases: [],
    });

    const updated = await updateCharacter("novel-1", character.id, {
      role_id: "role-protagonist",
    });

    expect(updated.role_id).toBe("role-protagonist");
    expect(updated.role).toBe("protagonist");
    expect(updated.role_name).toBe("Protagonist");
  });

  it("computes chapter_count and chapters[] via collectionGroup array-contains, ordered by number", async () => {
    const character = await createCharacter("novel-1", {
      name: "Dave",
      role: "minor",
      description: "",
      aliases: [],
    });
    await seedChapterWithCharacter("novel-1", "ch-2", 2, character.id);
    await seedChapterWithCharacter("novel-1", "ch-1", 1, character.id);

    const fetched = await getCharacter("novel-1", character.id);

    expect(fetched.chapter_count).toBe(2);
    expect(fetched.chapters?.map((c) => c.number)).toEqual([1, 2]);
  });

  it("getAllCharacters returns every character for a novel, unpaginated", async () => {
    await createCharacter("novel-1", { name: "A", role: "minor", description: "", aliases: [] });
    await createCharacter("novel-1", { name: "B", role: "minor", description: "", aliases: [] });
    await createCharacter("novel-2", { name: "C", role: "minor", description: "", aliases: [] });

    const all = await getAllCharacters("novel-1");

    expect(all.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("getCharacters paginates with a summary", async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createCharacter("novel-1", {
        name: `Char ${i}`,
        role: "minor",
        description: "",
        aliases: [],
      });
    }

    const page = await getCharacters("novel-1", { page: 1, perPage: 5 });

    expect(page.items).toHaveLength(3);
    expect(page.summary).toEqual({ total_characters: 3 });
  });

  it("throws when getting a character that does not exist", async () => {
    await expect(getCharacter("novel-1", "does-not-exist")).rejects.toThrow();
  });

  it("deletes a character", async () => {
    const character = await createCharacter("novel-1", {
      name: "Eve",
      role: "minor",
      description: "",
      aliases: [],
    });

    await deleteCharacter("novel-1", character.id);

    await expect(getCharacter("novel-1", character.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test characters.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the new Firestore index**

`apps/web/firestore.indexes.json` — add a third entry to the existing `"indexes"` array (leave the two Plan 2 entries and the `fieldOverrides` array untouched):

```json
{
  "collectionGroup": "chapters",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "character_ids", "arrayConfig": "CONTAINS" },
    { "fieldPath": "number", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 4: Write the implementation**

`apps/web/libs/firebase/characters.ts`:

```ts
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  DocumentReference,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type {
  Character,
  ChapterSummary,
  PaginatedCharacters,
} from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getCharacterRoles } from "./characterRoles";

interface CharacterDoc {
  name: string;
  aliases: string[];
  role_id: string;
  role: string;
  role_name: string;
  profile_image_url: string | null;
  description: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const ALLOWED_PER_PAGE = [5, 10, 20, 50];

function charactersCol(novelId: string) {
  return collection(db, "novels", novelId, "characters");
}

function characterRef(novelId: string, characterId: string) {
  return doc(db, "novels", novelId, "characters", characterId);
}

async function characterChapters(
  novelId: string,
  characterId: string,
): Promise<{ chapter_count: number; chapters: ChapterSummary[] }> {
  const q = query(
    collectionGroup(db, "chapters"),
    where("novel_id", "==", novelId),
    where("character_ids", "array-contains", characterId),
    orderBy("number", "asc"),
  );
  const snapshot = await getDocs(q);
  const chapters: ChapterSummary[] = snapshot.docs.map((d) => {
    const data = d.data() as {
      volume_id: string;
      number: number;
      title: string;
      read_at: Timestamp | null;
    };
    return {
      id: d.id,
      volume_id: data.volume_id,
      number: data.number,
      title: data.title,
      read_at: data.read_at ? tsToIso(data.read_at) : null,
    };
  });
  return { chapter_count: chapters.length, chapters };
}

async function toCharacter(
  novelId: string,
  id: string,
  data: CharacterDoc,
  hydrate: boolean,
): Promise<Character> {
  const base: Character = {
    id,
    novel_id: novelId,
    name: data.name,
    aliases: data.aliases,
    role_id: data.role_id,
    role: data.role,
    role_name: data.role_name,
    profile_image_url: data.profile_image_url,
    description: data.description,
    first_appearance_chapter_id: null,
    chapter_count: 0,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };

  if (!hydrate) return base;

  const { chapter_count, chapters } = await characterChapters(novelId, id);
  return {
    ...base,
    chapter_count,
    chapters,
    first_appearance_chapter_id: chapters[0]?.id ?? null,
  };
}

async function resolveRole(
  input: { role_id?: string; role?: string },
): Promise<{ role_id: string; role: string; role_name: string }> {
  const roles = await getCharacterRoles();

  if (input.role_id) {
    const match = roles.find((r) => r.id === input.role_id);
    if (!match) throw new Error("Request failed.");
    return { role_id: match.id, role: match.code, role_name: match.name };
  }

  if (input.role) {
    const match = roles.find((r) => r.code === input.role);
    if (!match) throw new Error("Request failed.");
    return { role_id: match.id, role: match.code, role_name: match.name };
  }

  const fallback = roles.find((r) => r.code === "minor") ?? roles[0];
  if (!fallback) throw new Error("Request failed.");
  return { role_id: fallback.id, role: fallback.code, role_name: fallback.name };
}

export interface CharacterCreatePayload {
  name: string;
  role_id?: string;
  role?: string;
  description: string;
  aliases: string[];
  profile_image_url?: string | null;
}

export async function createCharacter(
  novelId: string,
  payload: CharacterCreatePayload,
): Promise<Character> {
  const resolvedRole = await resolveRole(payload);
  const ref = await addDoc(
    charactersCol(novelId),
    withCreateTimestamps({
      name: payload.name,
      aliases: payload.aliases,
      description: payload.description,
      profile_image_url: payload.profile_image_url ?? null,
      ...resolvedRole,
    }),
  );
  const snapshot = await getDoc(ref);
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, false);
}

export interface CharacterUpdatePayload {
  name?: string;
  role_id?: string;
  role?: string;
  description?: string;
  aliases?: string[];
  profile_image_url?: string | null;
}

export async function updateCharacter(
  novelId: string,
  characterId: string,
  payload: CharacterUpdatePayload,
): Promise<Character> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.aliases !== undefined) update.aliases = payload.aliases;
  if (payload.profile_image_url !== undefined) {
    update.profile_image_url = payload.profile_image_url;
  }
  if (payload.role_id !== undefined || payload.role !== undefined) {
    Object.assign(update, await resolveRole(payload));
  }

  const ref = characterRef(novelId, characterId) as DocumentReference<
    CharacterDoc,
    CharacterDoc
  >;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, true);
}

export async function getCharacter(novelId: string, characterId: string): Promise<Character> {
  const snapshot = await getDoc(characterRef(novelId, characterId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, true);
}

export async function getAllCharacters(novelId: string): Promise<Character[]> {
  const snapshot = await getDocs(query(charactersCol(novelId), orderBy("name")));
  return Promise.all(
    snapshot.docs.map((d) => toCharacter(novelId, d.id, d.data() as CharacterDoc, false)),
  );
}

export async function getCharacters(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedCharacters> {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const perPage = ALLOWED_PER_PAGE.includes(options?.perPage as number)
    ? (options!.perPage as number)
    : 5;

  const all = await getAllCharacters(novelId);
  const totalItems = all.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const items = all.slice(start, start + perPage);

  return {
    items,
    pagination: { page, per_page: perPage, total_items: totalItems, total_pages: totalPages },
    summary: { total_characters: totalItems },
  };
}

export async function deleteCharacter(novelId: string, characterId: string): Promise<void> {
  await deleteDoc(characterRef(novelId, characterId));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/web && pnpm test characters.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Wire it into `libs/api/index.ts`**

Delete the existing `getCharacters` function body from `apps/web/libs/api/index.ts` and add:

```ts
export {
  getCharacters,
  getAllCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "@/libs/firebase/characters";
export type { CharacterCreatePayload, CharacterUpdatePayload } from "@/libs/firebase/characters";
```

- [ ] **Step 7: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/libs/firebase/characters.ts apps/web/libs/firebase/characters.test.ts apps/web/firestore.indexes.json apps/web/libs/api/index.ts
git commit -m "feat(web): migrate characters domain from Go API to Firestore"
```

---

## Task 3: Events domain via Firestore

**Files:**
- Create: `apps/web/libs/firebase/events.ts`
- Create: `apps/web/libs/firebase/events.test.ts`
- Modify: `apps/web/app/types.ts` (add `NovelEvent` type)

**Interfaces:**
- Consumes: `db`, `tsToIso`, `withCreateTimestamps`, `withUpdateTimestamp`, `getAllCharacters` (from `./characters`, Task 2) for `character_names` resolution.
- Produces: `getEvents(novelId): Promise<NovelEvent[]>`, `createEvent(novelId, payload: EventPayload): Promise<NovelEvent>`, `updateEvent(novelId, eventId, payload: EventPayload): Promise<NovelEvent>`, `deleteEvent(novelId, eventId): Promise<void>`, `type EventPayload = { title?: string; description?: string; story_date?: string; sort_order?: number; chapter_id?: string | null; chapter_volume_id?: string | null }`. This task does **not** wire `libs/api/index.ts` — events never had a Go-backed export there to replace (the timeline page always called the Go API directly), so there's nothing to re-export from. Task 6 wires the timeline page directly to these functions.

- [ ] **Step 1: Add the `NovelEvent` type**

In `apps/web/app/types.ts`, add (place near `ChapterSummary`, since `NovelEvent` references it conceptually):

```ts
export interface NovelEvent {
  id: string
  novel_id: string
  chapter_id: string | null
  chapter_volume_id: string | null
  chapter_title: string | null
  chapter_number: number | null
  title: string
  description: string
  story_date: string
  sort_order: number
  character_names: string[]
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Write the failing tests**

`apps/web/libs/firebase/events.test.ts`:

```ts
import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createEvent, deleteEvent, getEvents, updateEvent } from "./events";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

async function seedChapter(novelId: string, volumeId: string, chapterId: string, number: number, title: string) {
  await setDoc(doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId), {
    number,
    title,
    summary: "",
    read_at: null,
    novel_id: novelId,
    volume_id: volumeId,
    tag_ids: [],
    character_ids: [],
  });
}

describe("events", () => {
  it("creates an event with no chapter link", async () => {
    const event = await createEvent("novel-1", {
      title: "The Beginning",
      description: "It all started here.",
      story_date: "Year 1",
      sort_order: 0,
      chapter_id: null,
    });

    expect(event.title).toBe("The Beginning");
    expect(event.chapter_id).toBeNull();
    expect(event.chapter_title).toBeNull();
    expect(event.character_names).toEqual([]);
  });

  it("creates an event linked to a chapter, denormalizing chapter title/number", async () => {
    await seedChapter("novel-1", "vol-1", "ch-1", 3, "The Duel");

    const event = await createEvent("novel-1", {
      title: "Duel scene",
      description: "",
      story_date: "Year 2",
      sort_order: 1,
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
    });

    expect(event.chapter_id).toBe("ch-1");
    expect(event.chapter_volume_id).toBe("vol-1");
    expect(event.chapter_title).toBe("The Duel");
    expect(event.chapter_number).toBe(3);
  });

  it("updating chapter_id re-denormalizes chapter fields, and clearing it nulls them", async () => {
    await seedChapter("novel-1", "vol-1", "ch-1", 1, "First");
    await seedChapter("novel-1", "vol-1", "ch-2", 2, "Second");
    const event = await createEvent("novel-1", {
      title: "E",
      description: "",
      story_date: "Y1",
      sort_order: 0,
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
    });

    const moved = await updateEvent("novel-1", event.id, {
      chapter_id: "ch-2",
      chapter_volume_id: "vol-1",
    });
    expect(moved.chapter_title).toBe("Second");
    expect(moved.chapter_number).toBe(2);

    const cleared = await updateEvent("novel-1", event.id, { chapter_id: null });
    expect(cleared.chapter_id).toBeNull();
    expect(cleared.chapter_volume_id).toBeNull();
    expect(cleared.chapter_title).toBeNull();
    expect(cleared.chapter_number).toBeNull();
  });

  it("lists events for a novel ordered by sort_order", async () => {
    await createEvent("novel-1", {
      title: "B",
      description: "",
      story_date: "",
      sort_order: 2,
      chapter_id: null,
    });
    await createEvent("novel-1", {
      title: "A",
      description: "",
      story_date: "",
      sort_order: 1,
      chapter_id: null,
    });

    const events = await getEvents("novel-1");

    expect(events.map((e) => e.title)).toEqual(["A", "B"]);
  });

  it("deletes an event", async () => {
    const event = await createEvent("novel-1", {
      title: "Gone",
      description: "",
      story_date: "",
      sort_order: 0,
      chapter_id: null,
    });

    await deleteEvent("novel-1", event.id);

    const remaining = await getEvents("novel-1");
    expect(remaining.find((e) => e.id === event.id)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && pnpm test events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

`apps/web/libs/firebase/events.ts`:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { NovelEvent } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getAllCharacters } from "./characters";

interface EventDoc {
  title: string;
  description: string;
  story_date: string;
  sort_order: number;
  chapter_id: string | null;
  chapter_volume_id: string | null;
  chapter_title: string | null;
  chapter_number: number | null;
  character_ids: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function eventsCol(novelId: string) {
  return collection(db, "novels", novelId, "events");
}

function eventRef(novelId: string, eventId: string) {
  return doc(db, "novels", novelId, "events", eventId);
}

async function toEvent(novelId: string, id: string, data: EventDoc): Promise<NovelEvent> {
  const characterNames: string[] = [];
  if (data.character_ids.length > 0) {
    const all = await getAllCharacters(novelId);
    const byId = new Map(all.map((c) => [c.id, c.name]));
    data.character_ids.forEach((cid) => {
      const name = byId.get(cid);
      if (name) characterNames.push(name);
    });
  }

  return {
    id,
    novel_id: novelId,
    chapter_id: data.chapter_id,
    chapter_volume_id: data.chapter_volume_id,
    chapter_title: data.chapter_title,
    chapter_number: data.chapter_number,
    title: data.title,
    description: data.description,
    story_date: data.story_date,
    sort_order: data.sort_order,
    character_names: characterNames,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

async function resolveChapterFields(
  novelId: string,
  chapterId: string | null | undefined,
  volumeId: string | null | undefined,
): Promise<{
  chapter_id: string | null;
  chapter_volume_id: string | null;
  chapter_title: string | null;
  chapter_number: number | null;
}> {
  if (!chapterId) {
    return {
      chapter_id: null,
      chapter_volume_id: null,
      chapter_title: null,
      chapter_number: null,
    };
  }
  if (!volumeId) {
    throw new Error("chapter_volume_id is required when chapter_id is set");
  }
  const snapshot = await getDoc(
    doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId),
  );
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  const chapterData = snapshot.data() as { title: string; number: number };
  return {
    chapter_id: chapterId,
    chapter_volume_id: volumeId,
    chapter_title: chapterData.title,
    chapter_number: chapterData.number,
  };
}

export interface EventPayload {
  title?: string;
  description?: string;
  story_date?: string;
  sort_order?: number;
  chapter_id?: string | null;
  chapter_volume_id?: string | null;
}

export async function createEvent(novelId: string, payload: EventPayload): Promise<NovelEvent> {
  const chapterFields = await resolveChapterFields(
    novelId,
    payload.chapter_id,
    payload.chapter_volume_id,
  );
  const ref = await addDoc(
    eventsCol(novelId),
    withCreateTimestamps({
      title: payload.title ?? "",
      description: payload.description ?? "",
      story_date: payload.story_date ?? "",
      sort_order: payload.sort_order ?? 0,
      character_ids: [],
      ...chapterFields,
    }),
  );
  const snapshot = await getDoc(ref);
  return toEvent(novelId, snapshot.id, snapshot.data() as EventDoc);
}

export async function updateEvent(
  novelId: string,
  eventId: string,
  payload: EventPayload,
): Promise<NovelEvent> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.story_date !== undefined) update.story_date = payload.story_date;
  if (payload.sort_order !== undefined) update.sort_order = payload.sort_order;
  if (payload.chapter_id !== undefined) {
    Object.assign(
      update,
      await resolveChapterFields(novelId, payload.chapter_id, payload.chapter_volume_id),
    );
  }

  const ref = eventRef(novelId, eventId) as DocumentReference<EventDoc, EventDoc>;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  return toEvent(novelId, snapshot.id, snapshot.data() as EventDoc);
}

export async function getEvents(novelId: string): Promise<NovelEvent[]> {
  const snapshot = await getDocs(query(eventsCol(novelId), orderBy("sort_order", "asc")));
  return Promise.all(
    snapshot.docs.map((d) => toEvent(novelId, d.id, d.data() as EventDoc)),
  );
}

export async function deleteEvent(novelId: string, eventId: string): Promise<void> {
  await deleteDoc(eventRef(novelId, eventId));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/web && pnpm test events.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/events.ts apps/web/libs/firebase/events.test.ts apps/web/app/types.ts
git commit -m "feat(web): add events domain via Firestore, add NovelEvent type"
```

---

## Task 4: `getChaptersFlat` + remove Plan 2's temporary Go-API hybrid

**Files:**
- Modify: `apps/web/libs/firebase/chapters.ts` (add `getChaptersFlat`; remove `fetchNovelCharacters`/`MinimalCharacter`/`apiClient` import; rewire `linkMentions` and `getChapter`'s character hydration to Firestore)
- Modify: `apps/web/libs/firebase/chapters.test.ts` (add `getChaptersFlat` tests; the existing `it.skip`'d cross-service mention test can now be un-skipped and rewritten against the emulator, since characters no longer require the Go API)
- Modify: `apps/web/firestore.indexes.json`

**Interfaces:**
- Consumes: `getAllCharacters` (from `./characters`, Task 2) — replaces `fetchNovelCharacters`.
- Produces: `getChaptersFlat(novelId): Promise<ChapterSummary[]>`.

- [ ] **Step 1: Add the new Firestore index**

`apps/web/firestore.indexes.json` — add a fourth entry to `"indexes"`:

```json
{
  "collectionGroup": "chapters",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "novel_id", "order": "ASCENDING" },
    { "fieldPath": "number", "order": "ASCENDING" }
  ]
}
```

(The existing `novel_id`+`read_at` composite index doesn't serve this — different second field.)

- [ ] **Step 2: Write the failing test for `getChaptersFlat`**

Add to `apps/web/libs/firebase/chapters.test.ts` (add `getChaptersFlat` to the existing import line from `./chapters`):

```ts
describe("getChaptersFlat", () => {
  it("returns every chapter across all volumes in a novel, ordered by number", async () => {
    await seedVolume("novel-1", "vol-1");
    await seedVolume("novel-1", "vol-2");
    await createChapter("novel-1", "vol-2", { number: 3, title: "Three" });
    await createChapter("novel-1", "vol-1", { number: 1, title: "One" });
    await createChapter("novel-1", "vol-1", { number: 2, title: "Two" });

    const flat = await getChaptersFlat("novel-1");

    expect(flat.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(flat[2].volume_id).toBe("vol-2");
  });

  it("returns an empty array for a novel with no chapters", async () => {
    expect(await getChaptersFlat("no-such-novel")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: FAIL — `getChaptersFlat` is not exported yet.

- [ ] **Step 4: Implement `getChaptersFlat`**

Add to `apps/web/libs/firebase/chapters.ts` (reuses `collectionGroup`, `where`, `orderBy`, `query`, `getDocs` — all already imported in this file from prior tasks):

```ts
export async function getChaptersFlat(novelId: string): Promise<ChapterSummary[]> {
  const snapshot = await getDocs(
    query(
      collectionGroup(db, "chapters"),
      where("novel_id", "==", novelId),
      orderBy("number", "asc"),
    ),
  );
  return snapshot.docs.map((d) => {
    const data = d.data() as {
      volume_id: string;
      number: number;
      title: string;
      read_at: Timestamp | null;
    };
    return {
      id: d.id,
      volume_id: data.volume_id,
      number: data.number,
      title: data.title,
      read_at: data.read_at ? tsToIso(data.read_at) : null,
    };
  });
}
```

Add `ChapterSummary` to this file's `@/app/types` import list.

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: PASS.

- [ ] **Step 6: Remove the temporary hybrid**

In `apps/web/libs/firebase/chapters.ts`:

1. Delete the `import { apiClient } from "@/libs/api/client";` line.
2. Delete the `MinimalCharacter` interface and the `fetchNovelCharacters` function entirely.
3. Add `import { getAllCharacters } from "./characters";` to this file's imports.
4. In `linkMentions`, replace the line `const characters = await fetchNovelCharacters(novelId);` with `const characters = await getAllCharacters(novelId);` — everything else in `linkMentions` (the `try`/`catch`, the name-matching `.filter()`, the `arrayUnion` call) stays exactly as it is; only the source of `characters` changes.
5. In `getChapter`'s character-hydration branch, replace `(await fetchNovelCharacters(novelId).catch(() => []))` with `(await getAllCharacters(novelId).catch(() => []))`. The `.filter((c) => (data.character_ids ?? []).includes(c.id))` and the `as ChapterWithCharacters["characters"]` cast stay — `Character` (the real type `getAllCharacters` returns) is a superset of what `MinimalCharacter` provided, so the cast is now honest rather than a narrowing lie; you may remove the cast and replace it with a direct assignment if TypeScript accepts `Character[]` for `ChapterWithCharacters["characters"]` without one — check by running `tsc`.

- [ ] **Step 7: Un-skip and rewrite the cross-service mention test**

In `apps/web/libs/firebase/chapters.test.ts`, find the `it.skip("links a mentioned character's id into character_ids on chapter update", ...)` test (in the `describe("mention auto-link (temporary hybrid — reads characters from the Go API)", ...)` block). This hybrid no longer calls the Go API, so this test can run against the emulator alone now. Replace the whole `describe` block's title (drop "temporary hybrid — reads characters from the Go API" framing) and rewrite the skipped test to un-skip it and seed a real character via Firestore instead of relying on external Go/Postgres state:

```ts
describe("mention auto-link", () => {
  it("links a mentioned character's id into character_ids on chapter update", async () => {
    await seedVolume("novel-1", "vol-1");
    const character = await createCharacter("novel-1", {
      name: "TestMentionCharacter",
      role: "minor",
      description: "",
      aliases: [],
    });
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await updateChapter("novel-1", "vol-1", chapter.id, {
      summary: "[[TestMentionCharacter]] appears.",
    });

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);
    expect(fetched.characters.map((c) => c.id)).toContain(character.id);
  });

  it("does not throw when no characters match, and is non-blocking on lookup failure", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await expect(
      updateChapter("novel-1", "vol-1", chapter.id, {
        summary: "[[NobodyByThisName]] appears.",
      }),
    ).resolves.not.toThrow();
  });
});
```

Add `import { createCharacter } from "./characters";` to this test file's imports.

- [ ] **Step 8: Run to verify everything passes**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: PASS, including the now-unskipped mention test (real assertion, not `it.skip`).

- [ ] **Step 9: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors. Confirm via `grep -rn "apiClient" apps/web/libs/firebase/` that no `libs/firebase/*` file imports `apiClient` anymore.

- [ ] **Step 10: Commit**

```bash
git add apps/web/libs/firebase/chapters.ts apps/web/libs/firebase/chapters.test.ts apps/web/firestore.indexes.json
git commit -m "feat(web): add getChaptersFlat, remove temporary Go API character hybrid"
```

---

## Task 5: Rewire character web call sites

**Files:**
- Modify: `apps/web/app/novels/[id]/characters/AddCharacterForm.tsx`
- Modify: `apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`
- Modify: `apps/web/app/novels/[id]/characters/[characterId]/page.tsx`
- Modify: `apps/web/app/novels/[id]/characters/page.tsx`
- Modify: `apps/web/app/novels/[id]/page.tsx`

**Interfaces:**
- Consumes: `createCharacter`, `updateCharacter`, `getCharacter`, `getAllCharacters`, `getNovel` (all from `@/libs/api`, Tasks 1-2 and Plan 1).

- [ ] **Step 1: `AddCharacterForm.tsx` — use `createCharacter`**

Read the current file. It currently does a raw `fetch(${BASE}/api/v1/novels/${novelId}/characters, {method:'POST', body: JSON.stringify({name, role_id, description, aliases, ...})})`. Replace the `BASE` constant and the inline `fetch` call with `import { createCharacter } from '@/libs/api'` and `await createCharacter(novelId, { name, role_id, description, aliases })` (match whatever field set the current form actually collects — read the file first). Follow the exact same before/after shape Plan 1's `AddNovelForm.tsx` task used: remove the `BASE` constant, replace the `try { fetch(...) }` block's request with the new function call, keep the existing success/error/snackbar handling logic structurally the same, just fed by the new call's resolved value or thrown error instead of a parsed `Response`.

- [ ] **Step 2: `CharacterDetail.tsx` — use `updateCharacter`**

Read the current file. It currently does a raw `fetch(.../characters/${id}, {method:'PATCH', body: JSON.stringify({name, role_id, profile_image_url, description, aliases})})`. Replace with `import { updateCharacter } from '@/libs/api'` and `await updateCharacter(novelId, characterId, {...})`, same before/after pattern as Step 1.

- [ ] **Step 3: `characters/[characterId]/page.tsx` — use `getCharacter` singular, fix the stale local `getNovel`**

Read the current file. It has two local bypass functions: `getCharacter(novelId, characterId)` (raw `fetch`) and `getNovel(novelId)` (raw `fetch` — **this one is now silently broken**, since novels moved to Firestore in Plan 1 and this local fetch still reads a Postgres `novels` table that stopped receiving writes). Delete both local functions. Import `getCharacter` and `getNovel` from `@/libs/api` instead and call those. `getCharacterRoles` (already imported from `@/libs/api` per the existing code) stays as-is.

- [ ] **Step 4: `characters/page.tsx` — fix the stale local `getNovel`**

Read the current file. It already correctly uses `getCharacters`/`getCharacterRoles` from `@/libs/api`, but has the same stale local `getNovel` bypass as Step 3. Delete the local function, import `getNovel` from `@/libs/api` instead.

- [ ] **Step 5: `novels/[id]/page.tsx` — fix the stale local `getCharacters`**

Read the current file. It has a local `getCharacters(novelId): Promise<Character[]>` (raw `fetch`, no params, legacy-array mode) used only to compute a character count for a sidebar card. Delete it. Import `getAllCharacters` from `@/libs/api` and call `await getAllCharacters(novelId)` in its place — same return shape (`Character[]`), so the call site using `.length` on the result needs no other change.

- [ ] **Step 6: Run the linter and type check**

Run: `cd apps/web && pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors, no new `tsc` errors.

- [ ] **Step 7: Manual verification in the browser**

There is no component-testing setup in this repo. Verify by hand:

1. Start the emulator: `make firebase-emulators` (separate terminal)
2. Start the web app: `make web`
3. Since `AddNovelForm` is currently disabled in `app/novels/page.tsx` (pre-existing, unrelated to this migration — tracked in `docs/engineering/PROGRESS.md`), seed a novel directly via the emulator UI (`http://localhost:4000/firestore`) or a throwaway script call to `createNovel`, then navigate to that novel's characters page.
4. Add a character, confirm it appears in the list without a page reload.
5. Open the character's detail page, edit a field, confirm it saves.
6. Confirm the novel detail page's character count reflects the real count.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/novels/[id]/characters/AddCharacterForm.tsx apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx apps/web/app/novels/[id]/characters/[characterId]/page.tsx apps/web/app/novels/[id]/characters/page.tsx apps/web/app/novels/[id]/page.tsx
git commit -m "feat(web): wire character pages to Firestore, fix stale Postgres getNovel bypasses"
```

---

## Task 6: Rewire the timeline page to Firestore

**Files:**
- Modify: `apps/web/app/novels/[id]/timeline/page.tsx`

**Interfaces:**
- Consumes: `getEvents`, `createEvent`, `updateEvent`, `deleteEvent` (from `./events`, Task 3), `getChaptersFlat` (from `./chapters`, Task 4), `getAllCharacters` (from `./characters`, Task 2) — all via `@/libs/api`.

- [ ] **Step 1: Read the current file in full**

`apps/web/app/novels/[id]/timeline/page.tsx` is ~624 lines with several inline `fetch` calls: event list (`GET /events`), the chapter picker (`GET /chapters`, flat cross-volume — this is the one that's been broken since Plan 2), the character picker (`GET /characters`, legacy array mode), event create (`POST /events`), event update (`PATCH /events/{id}`), event delete (`DELETE /events/{id}`). Read the whole file before making changes — this task's replacements below name the data-layer calls precisely, but the surrounding component structure (state, JSX) is yours to preserve as-is; only the data-fetching/mutation calls change.

- [ ] **Step 2: Replace the event list fetch**

Replace the `fetch(${BASE}/api/v1/novels/${novelId}/events)` call with `import { getEvents } from '@/libs/api'` and `await getEvents(novelId)`. The returned shape (`NovelEvent[]`, per Task 3's new type in `app/types.ts`) is identical in name and shape to the local `NovelEvent` interface this file currently defines — delete that local interface entirely and add `NovelEvent` to this file's existing `import type {...} from "@/app/types"` line instead. No call-site renaming needed; only the import source changes.

- [ ] **Step 3: Replace the chapter picker fetch**

Replace the `fetch(${BASE}/api/v1/novels/${novelId}/chapters)` call (the flat, cross-volume one — this is the fix for the broken-since-Plan-2 bug) with `import { getChaptersFlat } from '@/libs/api'` and `await getChaptersFlat(novelId)`. The returned shape (`ChapterSummary[]`) should already match what this component's chapter-picker dropdown needs (`id`, `volume_id`, `number`, `title`). When the user selects a chapter in the picker, the component now has both `chapter_id` (the selected `ChapterSummary.id`) and `chapter_volume_id` (`ChapterSummary.volume_id`) available — both must be passed to `createEvent`/`updateEvent` in Step 5 below (this is the plan's chapter-denormalization design — see Global Constraints).

- [ ] **Step 4: Replace the character picker fetch**

Replace the `fetch(${BASE}/api/v1/novels/${novelId}/characters)` call (legacy array mode) with `import { getAllCharacters } from '@/libs/api'` and `await getAllCharacters(novelId)`.

- [ ] **Step 5: Replace create/update/delete**

Replace the `POST /events` call with `import { createEvent } from '@/libs/api'` and `await createEvent(novelId, { title, description, story_date, sort_order, chapter_id, chapter_volume_id })` — pull `chapter_volume_id` from whichever chapter the picker has selected (per Step 3), or omit/pass `null` for both when no chapter is selected. Replace the `PATCH /events/{id}` call with `await updateEvent(novelId, eventId, {...same shape...})`. Replace the `DELETE /events/{id}` call with `await deleteEvent(novelId, eventId)`.

- [ ] **Step 6: Character-name display**

This component currently reads `ev.character_names` directly from the event object for display (resolved server-side via the Go API's JOIN). `NovelEvent.character_names` (Task 3's type) provides the same field, resolved the same way (just via Firestore denormalization instead of a SQL JOIN) — no change needed at the display call sites, only at the data-fetching layer already covered by Steps 2-5.

- [ ] **Step 7: Run the linter and type check**

Run: `cd apps/web && pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors, no new `tsc` errors.

- [ ] **Step 8: Manual verification in the browser**

1. Start the emulator (`make firebase-emulators`) and the web app (`make web`).
2. Navigate to a novel's timeline page (seed a novel + a volume + a chapter via the emulator UI or throwaway script calls if needed, same as Task 5 Step 7).
3. Create an event with no chapter link — confirm it appears.
4. Create an event linked to a chapter — confirm the chapter title/number show correctly on the event.
5. Edit an event to change its linked chapter — confirm the denormalized fields update.
6. Delete an event — confirm it disappears.
7. Confirm the chapter picker now shows chapters from Firestore (previously empty/stale since Plan 2 — this is the regression fix).

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/novels/[id]/timeline/page.tsx
git commit -m "feat(web): migrate timeline page to Firestore, fix chapter-picker regression from Plan 2"
```

---

## What's Next

This plan completes every Firestore domain migration except the data migration script and repo cutover — that's Plan 4: a one-off Postgres → Firestore data migration script (reading every table, writing Firestore documents matching the schema this plan and Plans 1-2 established, including `chapterNumbers` marker docs for every existing chapter number), then retiring `apps/api` from `make dev`, dropping the Redis Docker Compose service, and updating `CLAUDE.md` / `docs/ai/CONTEXT.md` / `docs/engineering/DECISIONS.md` (add an ADR superseding ADR-002) to describe the new architecture. Full-text search stays deferred (no plan yet, per the original spec decision).
