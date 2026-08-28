# Firebase Volumes, Chapters & Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status (2026-08-28): DONE.** All 6 tasks implemented, task-reviewed, and the whole-plan final review passed clean (one small fix wave applied and re-verified). Branch `refactor`, commits `d17d277`..`645a3b1`. `libs/api/index.ts` now has exactly `getCharacters`/`getCharacterRoles` remaining Go-API-backed — everything else in this plan's scope (novels from Plan 1, tags, volumes, chapters CRUD+tag-linking+reorder+mention-link, getLastOrderNos) is Firestore-backed. SDD ledger was at `.superpowers/sdd/2026-08-28-firebase-volumes-chapters-tags/progress.md` (deleted per the skill's finish step — history lives in git from here).
>
> **Known regression this plan introduces, deliberately deferred to Plan 3 (not fixed here):** `apps/web/app/novels/[id]/timeline/page.tsx` still reads chapters from the Go API/Postgres. Since this plan moves chapters to Firestore-only, new chapters won't appear in the timeline's chapter-link dropdown, and existing timeline→chapter deep links will 404. Plan 3 must treat this as a chapters carryover item, not just a characters/events one.

**Goal:** Migrate the `volumes`, `chapters`, and `tags` domains off the Go API onto direct Firestore client SDK calls — the second slice of the full Firebase migration, building on Plan 1's foundation (`libs/firebase/app.ts`, `helpers.ts`, `testUtils.ts`) and the already-migrated `novels` domain.

**Architecture:** Same shape as Plan 1 — `apps/web` keeps its existing Server Component (reads) + Client Component (writes) structure. `apps/web/libs/api/index.ts` keeps its exported function names/signatures; only the implementation of the volumes/chapters/tags functions moves from `fetch()` against the Go API to the Firestore client SDK. `characters` and `events` (and the character-facing side of chapter↔character linking) stay on the Go API until Plan 3 — this plan uses a documented temporary hybrid (see Global Constraints) to keep `[[Name]]` mention auto-link working across that gap.

**Tech Stack:** Same as Plan 1 — Firebase JS SDK v11 (`firebase/app`, `firebase/firestore`), Firebase Local Emulator Suite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-firebase-migration-design.md` (data-model section) and `docs/superpowers/plans/2026-08-28-firebase-foundation-and-novels.md` (Plan 1 — established patterns this plan reuses: snake_case fields, `tsToIso`/`withCreateTimestamps`/`withUpdateTimestamp` helpers, emulator test harness, `"Request failed."` not-found error contract, `libs/api/index.ts` re-export pattern).

## Global Constraints

- Firestore document fields use **snake_case**, matching `apps/web/app/types.ts` exactly — same as Plan 1.
- No Cloud Functions, no Server Actions, no Admin SDK — only the `firebase` client package, same as Plan 1.
- Firestore security rules stay fully open (`allow read, write: if true`) — unchanged from Plan 1.
- **Data model for this plan:**
  ```
  novels/{novelId}
    volumes/{volumeId}
      - number, title, created_at, updated_at
      volumes/{volumeId}/chapters/{chapterId}
        - number, title, summary, read_at (Timestamp | null)
        - novel_id, volume_id   -- denormalized, set once at creation, immutable — enables
                                    collectionGroup('chapters') queries filtered without
                                    reading the whole tree (used by the novel-wide summary
                                    in Task 2 and the last-chapter-number lookup in Task 6)
        - tag_ids: string[]      -- replaces chapter_tags join table
        - character_ids: string[] -- replaces chapter_characters join table; populated
                                      only by mention auto-link (Task 5) for now — there is
                                      no manual link/unlink UI today (confirmed: none exists
                                      in the current app)
        - created_at, updated_at
    chapterNumbers/{number}    -- marker doc, novel-scoped chapter-number uniqueness index
                                   (empty doc except `{ chapter_id }`); ADR-005 requires this
                                   uniqueness, unlike the two relaxations below which are not
                                   business rules
    tags/{tagId}
      - name
  ```
- **Deliberately NOT enforced (scope decision, not an oversight):** volume-number uniqueness
  and tag-name uniqueness. The original Postgres `UNIQUE(novel_id, number)` on volumes and
  `UNIQUE(novel_id, name)` on tags were bare DB constraints with no app-level enforcement in
  the Go usecase layer (unlike chapter numbering, which has a documented ADR and explicit
  usecase-level check) — there is no business rule tying to them, no auth/multi-writer
  concurrency to guard against yet (ADR-003), and reproducing them would mean adding a
  marker-doc transaction to every volume/tag write for a constraint nothing currently
  depends on. `createVolume`/`updateVolume`/`createTag` are plain, non-transactional writes.
  Chapter-number uniqueness (ADR-005, has a dedicated usecase check today) is NOT relaxed —
  it keeps the marker-doc pattern from the spec.
- **Cascade delete IS required**, unlike the uniqueness relaxations above: Firestore does not
  auto-delete subcollections when a parent doc is deleted. `deleteVolume` (Task 2) must
  delete every chapter under it plus each chapter's `chapterNumbers` marker — orphaned
  chapters would otherwise still count toward the novel-wide chapter summary forever and
  permanently block their numbers from reuse.
- **Temporary hybrid for `[[Name]]` mention auto-link (Task 5):** characters still live in
  Postgres until Plan 3. The mention-link step resolves `[[Name]]` text to character IDs by
  calling the **existing, unmodified** Go endpoint directly via `apiClient` (imported from
  `@/libs/api/client`, NOT the `@/libs/api` barrel — importing the barrel would create a
  circular import, since `libs/api/index.ts` re-exports FROM `libs/firebase/chapters.ts`).
  This is scaffolding, not new Go code — remove it in Plan 3 by swapping the one call to the
  Firestore-backed character lookup once characters move.
- **`getVolumes`/`getVolume` compute `chapter_count`/`read_count` via Firestore's native
  aggregation queries (`getCountFromServer`)**, not denormalized counters — no transactional
  counter-maintenance needed on every chapter write. Per-volume counts (used for the current
  page's `items`) run a direct, unfiltered `getCountFromServer` against that volume's own
  chapters subcollection (no index needed). The novel-wide `summary` (all volumes, not just
  the current page) runs two `collectionGroup('chapters')` aggregation queries filtered by
  the denormalized `novel_id` field — these need the composite indexes added in Task 2.
- **Emulator/production index gap:** the Firestore emulator does **not** enforce composite
  index requirements the way production does — a query missing its index will run fine
  locally and only fail once deployed against a real project. `firestore.indexes.json` is
  still updated correctly in this plan (so the config is right when a real project exists),
  but there is no automated check here that catches a wrong index — this is a known gap
  callable out for whenever Plan 3 provisions a real Firebase project.
- **Volume list pagination fetches all volumes for the novel and paginates in memory**
  (`orderBy("number").get()` then `.slice()`), not cursor-based Firestore pagination —
  volumes-per-novel counts are expected to stay small (unlike chapters), and in-memory
  slicing exactly replicates the existing `page`/`per_page`/`total_pages` contract without
  needing `startAfter` cursor chains for arbitrary page jumps.

---

## Task 1: Tags domain via Firestore

**Files:**
- Create: `apps/web/libs/firebase/tags.ts`
- Create: `apps/web/libs/firebase/tags.test.ts`
- Modify: `apps/web/libs/api/index.ts` (replace `getTags`/`createTag` bodies with a re-export)

**Interfaces:**
- Consumes: `db` (from `./app`), `Tag` type (from `@/app/types`).
- Produces: `getTags(novelId: string): Promise<Tag[]>`, `createTag(novelId: string, name: string): Promise<Tag>`.

- [x] **Step 1: Write the failing tests**

`apps/web/libs/firebase/tags.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTag, getTags } from "./tags";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("tags", () => {
  it("creates a tag scoped to a novel", async () => {
    const tag = await createTag("novel-1", "Arc: Prologue");

    expect(tag.id).toBeTruthy();
    expect(tag.novel_id).toBe("novel-1");
    expect(tag.name).toBe("Arc: Prologue");
  });

  it("lists tags for a novel, sorted by name, scoped away from other novels", async () => {
    await createTag("novel-1", "Zeta");
    await createTag("novel-1", "Alpha");
    await createTag("novel-2", "Should not appear");

    const tags = await getTags("novel-1");

    expect(tags.map((t) => t.name)).toEqual(["Alpha", "Zeta"]);
    expect(tags.every((t) => t.novel_id === "novel-1")).toBe(true);
  });

  it("returns an empty array for a novel with no tags", async () => {
    expect(await getTags("no-such-novel")).toEqual([]);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run (with the emulator running via `make firebase-emulators`): `cd apps/web && pnpm test tags.test.ts`
Expected: FAIL with a module-not-found error for `./tags`.

- [x] **Step 3: Write the implementation**

`apps/web/libs/firebase/tags.ts`:

```ts
import { addDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import type { Tag } from "@/app/types";
import { db } from "./app";

interface TagDoc {
  name: string;
}

function tagsCol(novelId: string) {
  return collection(db, "novels", novelId, "tags");
}

function toTag(novelId: string, id: string, data: TagDoc): Tag {
  return { id, novel_id: novelId, name: data.name };
}

export async function getTags(novelId: string): Promise<Tag[]> {
  const snapshot = await getDocs(query(tagsCol(novelId), orderBy("name")));
  return snapshot.docs.map((d) => toTag(novelId, d.id, d.data() as TagDoc));
}

export async function createTag(novelId: string, name: string): Promise<Tag> {
  const ref = await addDoc(tagsCol(novelId), { name });
  return toTag(novelId, ref.id, { name });
}
```

- [x] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test tags.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Wire it into `libs/api/index.ts`**

In `apps/web/libs/api/index.ts`, delete the existing `getTags`/`createTag` function bodies and add to the Firestore re-export block near the top of the file (alongside the existing novels re-export from Plan 1):

```ts
export { getTags, createTag } from "@/libs/firebase/tags";
```

Leave every other function in the file untouched.

- [x] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass; `tsc` shows only the pre-existing, unrelated `NovelCover.tsx` error (see Plan 1's final review) — nothing new.

- [x] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/tags.ts apps/web/libs/firebase/tags.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate tags domain from Go API to Firestore"
```

---

## Task 2: Volumes domain via Firestore

**Files:**
- Create: `apps/web/libs/firebase/volumes.ts`
- Create: `apps/web/libs/firebase/volumes.test.ts`
- Modify: `apps/web/firestore.indexes.json`
- Modify: `apps/web/libs/api/index.ts` (replace `getVolumes`/`getVolume`/`createVolume`/`updateVolume`/`deleteVolume` bodies with a re-export)

**Interfaces:**
- Consumes: `db` (from `./app`), `tsToIso`, `withCreateTimestamps`, `withUpdateTimestamp` (from `./helpers`), `Volume`/`PaginatedVolumes`/`VolumeListSummary` types (from `@/app/types`).
- Produces: `getVolumes(novelId, {page?, perPage?}): Promise<PaginatedVolumes>`, `getVolume(novelId, volumeId): Promise<Volume>`, `createVolume(novelId, payload: VolumePayload): Promise<Volume>`, `updateVolume(novelId, volumeId, payload: VolumePayload): Promise<Volume>`, `deleteVolume(novelId, volumeId): Promise<void>`, `type VolumePayload = { number: number; title: string }`. Later tasks rely on the `chapterNumbers/{number}` marker-doc collection path documented in Global Constraints — `deleteVolume` here is the first code to touch it (deleting markers for a volume's chapters), even though Task 3 (chapters) is what creates them; a chapter marker doc is just `{ chapter_id: string }` at `novels/{novelId}/chapterNumbers/{number}`.

- [x] **Step 1: Write the failing tests**

`apps/web/libs/firebase/volumes.test.ts`:

```ts
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createVolume,
  deleteVolume,
  getVolume,
  getVolumes,
  updateVolume,
} from "./volumes";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

async function seedChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  number: number,
  read: boolean,
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId),
    {
      number,
      title: `Chapter ${number}`,
      summary: "",
      read_at: read ? Timestamp.now() : null,
      novel_id: novelId,
      volume_id: volumeId,
      tag_ids: [],
      character_ids: [],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    },
  );
  await setDoc(doc(db, "novels", novelId, "chapterNumbers", String(number)), {
    chapter_id: chapterId,
  });
}

describe("volumes", () => {
  it("creates a volume with generated id, timestamps, and zeroed counts", async () => {
    const volume = await createVolume("novel-1", { number: 1, title: "Volume One" });

    expect(volume.id).toBeTruthy();
    expect(volume.novel_id).toBe("novel-1");
    expect(volume.number).toBe(1);
    expect(volume.title).toBe("Volume One");
    expect(volume.chapter_count).toBe(0);
    expect(volume.read_count).toBe(0);
    expect(volume.created_at).toBe(volume.updated_at);
  });

  it("computes chapter_count and read_count for a single volume from its chapters", async () => {
    const volume = await createVolume("novel-1", { number: 1, title: "Volume One" });
    await seedChapter("novel-1", volume.id, "ch-1", 1, true);
    await seedChapter("novel-1", volume.id, "ch-2", 2, false);

    const fetched = await getVolume("novel-1", volume.id);

    expect(fetched.chapter_count).toBe(2);
    expect(fetched.read_count).toBe(1);
  });

  it("lists volumes paginated, ordered by number, with a novel-wide summary", async () => {
    for (let n = 1; n <= 7; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const v = await createVolume("novel-1", { number: n, title: `Volume ${n}` });
      // eslint-disable-next-line no-await-in-loop
      await seedChapter("novel-1", v.id, `ch-${n}`, n, n % 2 === 0);
    }

    const page1 = await getVolumes("novel-1", { page: 1, perPage: 5 });
    expect(page1.items.map((v) => v.number)).toEqual([1, 2, 3, 4, 5]);
    expect(page1.pagination).toEqual({
      page: 1,
      per_page: 5,
      total_items: 7,
      total_pages: 2,
    });
    expect(page1.summary).toEqual({
      total_volumes: 7,
      total_chapters: 7,
      read_count: 3,
    });

    const page2 = await getVolumes("novel-1", { page: 2, perPage: 5 });
    expect(page2.items.map((v) => v.number)).toEqual([6, 7]);
    expect(page2.summary).toEqual({
      total_volumes: 7,
      total_chapters: 7,
      read_count: 3,
    });
  });

  it("defaults page to 1 and per_page to 5, falling back on an unsupported per_page", async () => {
    await createVolume("novel-1", { number: 1, title: "Volume One" });

    const result = await getVolumes("novel-1", { perPage: 999 });

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.per_page).toBe(5);
  });

  it("updates a volume's number and title", async () => {
    const volume = await createVolume("novel-1", { number: 1, title: "Old Title" });

    const updated = await updateVolume("novel-1", volume.id, {
      number: 2,
      title: "New Title",
    });

    expect(updated.number).toBe(2);
    expect(updated.title).toBe("New Title");
  });

  it("throws when getting a volume that does not exist", async () => {
    await expect(getVolume("novel-1", "does-not-exist")).rejects.toThrow();
  });

  it("deletes a volume and cascades to its chapters and their number markers", async () => {
    const volume = await createVolume("novel-1", { number: 1, title: "Volume One" });
    await seedChapter("novel-1", volume.id, "ch-1", 1, false);
    await seedChapter("novel-1", volume.id, "ch-2", 2, false);

    await deleteVolume("novel-1", volume.id);

    await expect(getVolume("novel-1", volume.id)).rejects.toThrow();
    const remaining = await getVolumes("novel-1");
    expect(remaining.summary).toEqual({
      total_volumes: 0,
      total_chapters: 0,
      read_count: 0,
    });
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test volumes.test.ts`
Expected: FAIL with a module-not-found error for `./volumes`.

- [x] **Step 3: Update Firestore indexes**

`apps/web/firestore.indexes.json` — replace the empty `indexes` array with:

```json
{
  "indexes": [
    {
      "collectionGroup": "chapters",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "novel_id", "order": "ASCENDING" },
        { "fieldPath": "read_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "chapters",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "volume_id", "order": "ASCENDING" },
        { "fieldPath": "number", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

(The second index is for Task 6's last-chapter-number lookup — added now so this file only needs one edit across the whole plan; unused until Task 6 lands.)

- [x] **Step 4: Write the implementation**

`apps/web/libs/firebase/volumes.ts`:

```ts
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { PaginatedVolumes, Volume, VolumeListSummary } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";

interface VolumeDoc {
  number: number;
  title: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const ALLOWED_PER_PAGE = [5, 10, 20, 50];
const BATCH_CHUNK_SIZE = 200; // chapter+marker = 2 ops/chapter, stays well under the 500-op cap

function volumesCol(novelId: string) {
  return collection(db, "novels", novelId, "volumes");
}

function chaptersCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "chapters");
}

async function volumeAggregates(novelId: string, volumeId: string) {
  const col = chaptersCol(novelId, volumeId);
  const [totalSnap, readSnap] = await Promise.all([
    getCountFromServer(col),
    getCountFromServer(query(col, where("read_at", "!=", null))),
  ]);
  return {
    chapter_count: totalSnap.data().count,
    read_count: readSnap.data().count,
  };
}

async function toVolume(novelId: string, id: string, data: VolumeDoc): Promise<Volume> {
  const { chapter_count, read_count } = await volumeAggregates(novelId, id);
  return {
    id,
    novel_id: novelId,
    number: data.number,
    title: data.title,
    chapter_count,
    read_count,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

export interface VolumePayload {
  number: number;
  title: string;
}

export async function getVolumes(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedVolumes> {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const perPage = ALLOWED_PER_PAGE.includes(options?.perPage as number)
    ? (options!.perPage as number)
    : 5;

  const allSnap = await getDocs(query(volumesCol(novelId), orderBy("number", "asc")));
  const totalItems = allSnap.size;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const pageDocs = allSnap.docs.slice(start, start + perPage);
  const items = await Promise.all(
    pageDocs.map((d) => toVolume(novelId, d.id, d.data() as VolumeDoc)),
  );

  const novelChapters = collectionGroup(db, "chapters");
  const [totalVolumesSnap, novelChaptersSnap, novelReadSnap] = await Promise.all([
    getCountFromServer(volumesCol(novelId)),
    getCountFromServer(query(novelChapters, where("novel_id", "==", novelId))),
    getCountFromServer(
      query(novelChapters, where("novel_id", "==", novelId), where("read_at", "!=", null)),
    ),
  ]);

  const summary: VolumeListSummary = {
    total_volumes: totalVolumesSnap.data().count,
    total_chapters: novelChaptersSnap.data().count,
    read_count: novelReadSnap.data().count,
  };

  return {
    items,
    pagination: { page, per_page: perPage, total_items: totalItems, total_pages: totalPages },
    summary,
  };
}

export async function getVolume(novelId: string, volumeId: string): Promise<Volume> {
  const snapshot = await getDoc(doc(db, "novels", novelId, "volumes", volumeId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function createVolume(novelId: string, payload: VolumePayload): Promise<Volume> {
  const ref = await addDoc(volumesCol(novelId), withCreateTimestamps(payload));
  const snapshot = await getDoc(ref);
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function updateVolume(
  novelId: string,
  volumeId: string,
  payload: VolumePayload,
): Promise<Volume> {
  const ref = doc(db, "novels", novelId, "volumes", volumeId);
  await updateDoc(ref, withUpdateTimestamp(payload));
  const snapshot = await getDoc(ref);
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function deleteVolume(novelId: string, volumeId: string): Promise<void> {
  const chapterDocs = await getDocs(chaptersCol(novelId, volumeId));

  for (let i = 0; i < chapterDocs.docs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = chapterDocs.docs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((chapterDoc) => {
      const number = (chapterDoc.data() as { number: number }).number;
      batch.delete(chapterDoc.ref);
      batch.delete(doc(db, "novels", novelId, "chapterNumbers", String(number)));
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  await deleteDoc(doc(db, "novels", novelId, "volumes", volumeId));
}
```

- [x] **Step 5: Run to verify it passes**

Run: `cd apps/web && pnpm test volumes.test.ts`
Expected: PASS (8 tests).

- [x] **Step 6: Wire it into `libs/api/index.ts`**

In `apps/web/libs/api/index.ts`, delete the existing `getVolumes`/`getVolume`/`createVolume`/`updateVolume`/`deleteVolume` function bodies and add to the Firestore re-export block:

```ts
export { getVolumes, getVolume, createVolume, updateVolume, deleteVolume } from "@/libs/firebase/volumes";
export type { VolumePayload } from "@/libs/firebase/volumes";
```

Leave every other function untouched.

- [x] **Step 7: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [x] **Step 8: Commit**

```bash
git add apps/web/libs/firebase/volumes.ts apps/web/libs/firebase/volumes.test.ts apps/web/firestore.indexes.json apps/web/libs/api/index.ts
git commit -m "feat(web): migrate volumes domain from Go API to Firestore"
```

---

## Task 3: Chapters domain via Firestore (create, get, update, delete, tag link/unlink)

**Files:**
- Create: `apps/web/libs/firebase/chapters.ts`
- Create: `apps/web/libs/firebase/chapters.test.ts`
- Modify: `apps/web/libs/api/index.ts` (replace `getChaptersByVolume`/`getChapter`/`updateChapter`/`deleteChapter`/`createChapter`/`linkChapterTag`/`unlinkChapterTag` bodies with a re-export)

**Interfaces:**
- Consumes: `db`, `tsToIso`, `withCreateTimestamps`, `withUpdateTimestamp` (Plan 1 + Task 2 pattern), `getTags` (from `./tags`, Task 1) for tag hydration, `apiClient` (from `@/libs/api/client`, NOT the barrel) for the temporary character hydration hybrid, `Chapter`/`ChapterWithCharacters`/`Tag`/`Character` types.
- Produces: `getChaptersByVolume(novelId, volumeId): Promise<Chapter[]>`, `getChapter(novelId, volumeId, chapterId): Promise<ChapterWithCharacters>`, `updateChapter(novelId, volumeId, chapterId, payload: ChapterPayload): Promise<void>`, `deleteChapter(novelId, volumeId, chapterId): Promise<void>`, `createChapter(novelId, volumeId, payload: ChapterCreatePayload): Promise<Chapter>`, `linkChapterTag(novelId, volumeId, chapterId, tagId): Promise<void>`, `unlinkChapterTag(...): Promise<void>`, `type ChapterPayload = { title?: string; summary?: string; read_at?: string | null }`, `type ChapterCreatePayload = { number: number; title: string; summary?: string; read_at?: string | null }`. This task does **not** implement mention auto-link yet (Task 5) or reorder (Task 4) — `updateChapter` here is a plain field update only.

- [x] **Step 1: Write the failing tests**

`apps/web/libs/firebase/chapters.test.ts`:

```ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createTag } from "./tags";
import {
  createChapter,
  deleteChapter,
  getChapter,
  getChaptersByVolume,
  linkChapterTag,
  unlinkChapterTag,
  updateChapter,
} from "./chapters";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

async function seedVolume(novelId: string, volumeId: string) {
  await setDoc(doc(db, "novels", novelId, "volumes", volumeId), {
    number: 1,
    title: "Volume One",
  });
}

describe("chapters", () => {
  it("creates a chapter, sets a chapterNumbers marker, and denormalizes novel_id/volume_id", async () => {
    await seedVolume("novel-1", "vol-1");

    const chapter = await createChapter("novel-1", "vol-1", {
      number: 1,
      title: "Chapter One",
      summary: "Something happens.",
    });

    expect(chapter.id).toBeTruthy();
    expect(chapter.number).toBe(1);
    expect(chapter.tags).toEqual([]);

    const marker = await getDoc(doc(db, "novels", "novel-1", "chapterNumbers", "1"));
    expect(marker.exists()).toBe(true);
    expect(marker.data()).toEqual({ chapter_id: chapter.id });
  });

  it("rejects creating a chapter whose number is already used elsewhere in the novel", async () => {
    await seedVolume("novel-1", "vol-1");
    await seedVolume("novel-1", "vol-2");
    await createChapter("novel-1", "vol-1", { number: 5, title: "First" });

    await expect(
      createChapter("novel-1", "vol-2", { number: 5, title: "Duplicate" }),
    ).rejects.toThrow();
  });

  it("lists chapters for a volume ordered by number", async () => {
    await seedVolume("novel-1", "vol-1");
    await createChapter("novel-1", "vol-1", { number: 2, title: "Two" });
    await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    const chapters = await getChaptersByVolume("novel-1", "vol-1");

    expect(chapters.map((c) => c.number)).toEqual([1, 2]);
  });

  it("gets a chapter with hydrated tags (characters hydration covered separately, hybrid, in Task 5)", async () => {
    await seedVolume("novel-1", "vol-1");
    const tag = await createTag("novel-1", "Flashback");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });
    await linkChapterTag("novel-1", "vol-1", chapter.id, tag.id);

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);

    expect(fetched.tags).toEqual([{ id: tag.id, novel_id: "novel-1", name: "Flashback" }]);
    expect(fetched.characters).toEqual([]);
  });

  it("throws when getting a chapter that does not exist", async () => {
    await seedVolume("novel-1", "vol-1");
    await expect(getChapter("novel-1", "vol-1", "does-not-exist")).rejects.toThrow();
  });

  it("updates a chapter's title/summary/read_at without touching its number", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await updateChapter("novel-1", "vol-1", chapter.id, {
      title: "One (revised)",
      read_at: "2026-08-28T00:00:00Z",
    });

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);
    expect(fetched.title).toBe("One (revised)");
    expect(fetched.read_at).toBe("2026-08-28T00:00:00.000Z");
    expect(fetched.number).toBe(1);
  });

  it("links and unlinks a tag on a chapter", async () => {
    await seedVolume("novel-1", "vol-1");
    const tag = await createTag("novel-1", "Arc");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await linkChapterTag("novel-1", "vol-1", chapter.id, tag.id);
    expect((await getChapter("novel-1", "vol-1", chapter.id)).tags.map((t) => t.id)).toEqual([
      tag.id,
    ]);

    await unlinkChapterTag("novel-1", "vol-1", chapter.id, tag.id);
    expect((await getChapter("novel-1", "vol-1", chapter.id)).tags).toEqual([]);
  });

  it("deletes a chapter and its chapterNumbers marker, freeing the number for reuse", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await deleteChapter("novel-1", "vol-1", chapter.id);

    const marker = await getDoc(doc(db, "novels", "novel-1", "chapterNumbers", "1"));
    expect(marker.exists()).toBe(false);
    await expect(
      createChapter("novel-1", "vol-1", { number: 1, title: "Reused" }),
    ).resolves.toBeTruthy();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: FAIL with a module-not-found error for `./chapters`.

- [x] **Step 3: Write the implementation**

`apps/web/libs/firebase/chapters.ts`:

```ts
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { Chapter, ChapterWithCharacters, Tag } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getTags } from "./tags";

interface ChapterDoc {
  number: number;
  title: string;
  summary: string;
  read_at: Timestamp | null;
  novel_id: string;
  volume_id: string;
  tag_ids: string[];
  character_ids: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function chaptersCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "chapters");
}

function chapterRef(novelId: string, volumeId: string, chapterId: string) {
  return doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId);
}

function markerRef(novelId: string, number: number) {
  return doc(db, "novels", novelId, "chapterNumbers", String(number));
}

async function toChapter(id: string, data: ChapterDoc, tags: Tag[]): Promise<Chapter> {
  return {
    id,
    volume_id: data.volume_id,
    number: data.number,
    title: data.title,
    summary: data.summary,
    read_at: data.read_at ? tsToIso(data.read_at) : null,
    tags,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

async function tagsForChapter(novelId: string, tagIds: string[]): Promise<Tag[]> {
  if (tagIds.length === 0) return [];
  const allTags = await getTags(novelId);
  const byId = new Map(allTags.map((t) => [t.id, t]));
  return tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t));
}

export async function getChaptersByVolume(
  novelId: string,
  volumeId: string,
): Promise<Chapter[]> {
  const snapshot = await getDocs(
    query(chaptersCol(novelId, volumeId), orderBy("number", "asc")),
  );
  return Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data() as ChapterDoc;
      return toChapter(d.id, data, await tagsForChapter(novelId, data.tag_ids));
    }),
  );
}

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
  const tags = await tagsForChapter(novelId, data.tag_ids);
  const chapter = await toChapter(snapshot.id, data, tags);
  // Character hydration is added in Task 5 alongside mention auto-link (both need the
  // same temporary Go-API character lookup) — empty for now, matching a chapter with no
  // linked characters yet.
  return { ...chapter, characters: [] };
}

export interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  read_at?: string | null;
}

export async function createChapter(
  novelId: string,
  volumeId: string,
  payload: ChapterCreatePayload,
): Promise<Chapter> {
  const chapterRefNew = doc(chaptersCol(novelId, volumeId));
  const marker = markerRef(novelId, payload.number);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(marker);
    if (existing.exists()) {
      throw new Error("chapter number already exists in this novel");
    }
    tx.set(marker, { chapter_id: chapterRefNew.id });
    tx.set(
      chapterRefNew,
      withCreateTimestamps({
        number: payload.number,
        title: payload.title,
        summary: payload.summary ?? "",
        read_at: payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null,
        novel_id: novelId,
        volume_id: volumeId,
        tag_ids: [],
        character_ids: [],
      }),
    );
  });

  const snapshot = await getDoc(chapterRefNew);
  return toChapter(snapshot.id, snapshot.data() as ChapterDoc, []);
}

export interface ChapterPayload {
  title?: string;
  summary?: string;
  read_at?: string | null;
}

export async function updateChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  payload: ChapterPayload,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.read_at !== undefined) {
    update.read_at = payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null;
  }
  await updateDoc(chapterRef(novelId, volumeId, chapterId), withUpdateTimestamp(update));
}

export async function deleteChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = chapterRef(novelId, volumeId, chapterId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    const { number } = snapshot.data() as ChapterDoc;
    tx.delete(ref);
    tx.delete(markerRef(novelId, number));
  });
}

export async function linkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(chapterRef(novelId, volumeId, chapterId), {
    tag_ids: arrayUnion(tagId),
  });
}

export async function unlinkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(chapterRef(novelId, volumeId, chapterId), {
    tag_ids: arrayRemove(tagId),
  });
}
```

- [x] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Wire it into `libs/api/index.ts`**

In `apps/web/libs/api/index.ts`, delete the existing `getChaptersByVolume`/`getChapter`/`updateChapter`/`deleteChapter`/`createChapter`/`linkChapterTag`/`unlinkChapterTag` function bodies (and the now-redundant local `ChapterPayload`/`ChapterCreatePayload`/`ChapterOrderEntry` type definitions — keep `ChapterOrderEntry` only if Task 4 hasn't landed yet, otherwise it's re-exported from there too) and add:

```ts
export {
  getChaptersByVolume,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  linkChapterTag,
  unlinkChapterTag,
} from "@/libs/firebase/chapters";
export type { ChapterPayload, ChapterCreatePayload } from "@/libs/firebase/chapters";
```

Leave `getVolumes`/`getVolume`/etc. (Task 2's re-export), `getTags`/`createTag` (Task 1's), and everything not yet migrated (`reorderChapters`, `getCharacters`, `getCharacterRoles`, `getLastOrderNos`) untouched.

- [x] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [x] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/chapters.ts apps/web/libs/firebase/chapters.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate chapters domain (CRUD + tag linking) from Go API to Firestore"
```

---

## Task 4: Chapter bulk reorder via Firestore

**Files:**
- Modify: `apps/web/libs/firebase/chapters.ts` (add `reorderChapters`)
- Modify: `apps/web/libs/firebase/chapters.test.ts` (add reorder tests)
- Modify: `apps/web/libs/api/index.ts` (replace `reorderChapters` body with a re-export)

**Interfaces:**
- Consumes: everything Task 3 produces, plus `writeBatch` from `firebase/firestore`.
- Produces: `reorderChapters(novelId, volumeId, entries: ChapterOrderEntry[]): Promise<void>`, `type ChapterOrderEntry = { id: string; number: number }` (matches the existing exported type in `libs/api/index.ts` today — re-export it from here instead of redefining).

- [x] **Step 1: Write the failing tests**

Append to `apps/web/libs/firebase/chapters.test.ts` (add `reorderChapters` and `ChapterOrderEntry` to the existing import line from `./chapters`, and `doc, getDoc` are already imported):

```ts
describe("reorderChapters", () => {
  it("renumbers chapters and moves their chapterNumbers markers atomically", async () => {
    await seedVolume("novel-1", "vol-1");
    const a = await createChapter("novel-1", "vol-1", { number: 1, title: "A" });
    const b = await createChapter("novel-1", "vol-1", { number: 2, title: "B" });
    const c = await createChapter("novel-1", "vol-1", { number: 3, title: "C" });

    const newOrder: ReorderEntry[] = [
      { id: c.id, number: 1 },
      { id: a.id, number: 2 },
      { id: b.id, number: 3 },
    ];
    await reorderChapters("novel-1", "vol-1", newOrder);

    const chapters = await getChaptersByVolume("novel-1", "vol-1");
    expect(chapters.map((ch) => ({ id: ch.id, number: ch.number }))).toEqual([
      { id: c.id, number: 1 },
      { id: a.id, number: 2 },
      { id: b.id, number: 3 },
    ]);

    for (const entry of newOrder) {
      // eslint-disable-next-line no-await-in-loop
      const marker = await getDoc(doc(db, "novels", "novel-1", "chapterNumbers", String(entry.number)));
      expect(marker.data()).toEqual({ chapter_id: entry.id });
    }
  });

  it("is a no-op-safe partial reorder — only entries present in the list move", async () => {
    await seedVolume("novel-1", "vol-1");
    const a = await createChapter("novel-1", "vol-1", { number: 1, title: "A" });
    const b = await createChapter("novel-1", "vol-1", { number: 2, title: "B" });

    await reorderChapters("novel-1", "vol-1", [{ id: a.id, number: 2 }, { id: b.id, number: 1 }]);

    const chapters = await getChaptersByVolume("novel-1", "vol-1");
    expect(chapters.map((ch) => ch.id)).toEqual([b.id, a.id]);
  });
});
```

Add `reorderChapters` and the type (call it `ReorderEntry` in the test import to avoid a name clash if `ChapterOrderEntry` isn't exported from `./chapters` under that exact name — match whatever Step 3 below actually exports) to the top import line.

- [x] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: FAIL — `reorderChapters` is not exported yet.

- [x] **Step 3: Write the implementation**

Add `serverTimestamp` and `writeBatch` to `apps/web/libs/firebase/chapters.ts`'s existing `firebase/firestore` import list (neither is imported there yet), then add:

```ts
export interface ChapterOrderEntry {
  id: string;
  number: number;
}

export async function reorderChapters(
  novelId: string,
  volumeId: string,
  entries: ChapterOrderEntry[],
): Promise<void> {
  const batch = writeBatch(db);
  entries.forEach((entry) => {
    batch.update(chapterRef(novelId, volumeId, entry.id), {
      number: entry.number,
      updated_at: serverTimestamp(),
    });
    batch.set(markerRef(novelId, entry.number), { chapter_id: entry.id });
  });
  await batch.commit();
}
```

This function deliberately does **not** validate that `entries` covers every chapter in the volume or that numbers don't collide with chapters NOT in the list — the old `BulkReorder` usecase pre-validated `Number > 0` and no in-request duplicates but trusted the caller (the drag-and-drop UI) to submit a full, consistent reordering of one volume's existing numbers; this port preserves that same trust boundary, matching CLAUDE.md's "Chapter reorder uses number mutation" note.

- [x] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: PASS (10 tests total in this file).

- [x] **Step 5: Wire it into `libs/api/index.ts`**

Replace the existing `reorderChapters` body and the local `ChapterOrderEntry` interface in `apps/web/libs/api/index.ts` with:

```ts
export { reorderChapters } from "@/libs/firebase/chapters";
export type { ChapterOrderEntry } from "@/libs/firebase/chapters";
```

(fold this into the same re-export block added in Task 3's Step 5 rather than a second block).

- [x] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [x] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/chapters.ts apps/web/libs/firebase/chapters.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate chapter bulk reorder from Go API to Firestore"
```

---

## Task 5: `[[Name]]` mention auto-link (temporary hybrid) + character hydration

**Files:**
- Modify: `apps/web/libs/firebase/chapters.ts` (mention-link helper, wire into `updateChapter`, character hydration in `getChapter`)
- Create: `apps/web/libs/firebase/mentions.ts` (regex extraction — pure function, kept separate so it's trivially unit-testable without the emulator)
- Create: `apps/web/libs/firebase/mentions.test.ts`
- Modify: `apps/web/libs/firebase/chapters.test.ts` (add mention-link integration tests)

**Interfaces:**
- Consumes: `apiClient` (from `@/libs/api/client` — the low-level fetch wrapper, not the `@/libs/api` barrel, to avoid a circular import since the barrel re-exports from this file).
- Produces: `extractMentions(summary: string): string[]` (from `./mentions`), and modifies `updateChapter`/`getChapter` in `chapters.ts` — no new `libs/api` export, this enhances existing ones.

- [x] **Step 1: Write the failing test for mention extraction**

`apps/web/libs/firebase/mentions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractMentions } from "./mentions";

describe("extractMentions", () => {
  it("extracts [[Name]] mentions from text", () => {
    expect(extractMentions("[[Alice]] met [[Bob]] at the market.")).toEqual(["Alice", "Bob"]);
  });

  it("de-duplicates repeated mentions", () => {
    expect(extractMentions("[[Alice]] and [[Alice]] again.")).toEqual(["Alice"]);
  });

  it("returns an empty array for text with no mentions", () => {
    expect(extractMentions("Nothing here.")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(extractMentions("")).toEqual([]);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test mentions.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Write the extraction implementation**

`apps/web/libs/firebase/mentions.ts`:

```ts
const MENTION_PATTERN = /\[\[([^\]]+)\]\]/g;

export function extractMentions(summary: string): string[] {
  const names = new Set<string>();
  for (const match of summary.matchAll(MENTION_PATTERN)) {
    const name = match[1].trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}
```

- [x] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test mentions.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Write the failing integration test for mention auto-link**

Append to `apps/web/libs/firebase/chapters.test.ts`. This test needs a real character to resolve against — it calls the temporary hybrid, which hits the **Go API's** character endpoint, so it requires `make api` running too (document this in the test file as a comment), not just the Firestore emulator:

```ts
describe("mention auto-link (temporary hybrid — reads characters from the Go API)", () => {
  // Requires `make api` running against a Postgres instance with a character named
  // "TestMentionCharacter" for novel "novel-1" — this hybrid is removed in Plan 3
  // once characters move to Firestore, at which point this test moves to a plain
  // emulator-backed test like the rest of this file.
  it.skip("links a mentioned character's id into character_ids on chapter update", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    await updateChapter("novel-1", "vol-1", chapter.id, {
      summary: "[[TestMentionCharacter]] appears.",
    });

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);
    expect(fetched.characters.map((c) => c.name)).toContain("TestMentionCharacter");
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

The first test is `it.skip` deliberately — it requires cross-service test setup (Go API + Postgres with seeded data) beyond what this plan's emulator-only harness provides, and this hybrid is temporary scaffolding removed in Plan 3. The second test covers the behavior that matters for THIS plan without that dependency: a summary with no resolvable mentions, or a failed lookup, must never fail the chapter update (matching the original ADR: "LinkMentions errors are non-blocking — logged as warn, do not fail the update").

- [x] **Step 6: Run to verify the non-skipped test fails**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: FAIL (or passes vacuously if `updateChapter` already never throws — if so, this step's "expected failure" is actually about the next step making the behavior *real* rather than accidental; proceed to Step 7 regardless and confirm the assertion is exercising real mention-resolution code, not a no-op, by checking coverage/console output during Step 8).

- [x] **Step 7: Write the mention-link implementation**

Modify `apps/web/libs/firebase/chapters.ts`:

Add imports: `import { apiClient } from "@/libs/api/client";` and `import { extractMentions } from "./mentions";`.

Add this helper (character shape kept minimal — only what's needed to resolve names to ids and hydrate `getChapter`'s response):

```ts
interface MinimalCharacter {
  id: string;
  name: string;
}

// TEMPORARY hybrid: characters still live in Postgres until Plan 3. Resolves [[Name]]
// mentions and hydrates chapter.characters by calling the existing, unmodified Go
// endpoint directly via apiClient (not the @/libs/api barrel, which would create a
// circular import since it re-exports from this file). Remove this function and call
// the Firestore-backed character lookup instead once Plan 3 lands.
async function fetchNovelCharacters(novelId: string): Promise<MinimalCharacter[]> {
  const response = await apiClient.get<{ data: MinimalCharacter[] }>(
    `/api/v1/novels/${novelId}/characters`,
  );
  return response.data ?? [];
}

async function linkMentions(
  novelId: string,
  volumeId: string,
  chapterId: string,
  summary: string,
): Promise<void> {
  try {
    const names = extractMentions(summary);
    if (names.length === 0) return;

    const characters = await fetchNovelCharacters(novelId);
    const matchedIds = characters.filter((c) => names.includes(c.name)).map((c) => c.id);
    if (matchedIds.length === 0) return;

    await updateDoc(chapterRef(novelId, volumeId, chapterId), {
      character_ids: arrayUnion(...matchedIds),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[linkMentions] non-blocking failure:", error);
  }
}
```

`arrayUnion` (already imported in this file from Task 3) makes this additive-only, matching the "LinkMentions is additive — never removes existing chapter_characters rows" constraint from the original ADR.

Now wire it into `updateChapter` — after the existing `await updateDoc(chapterRef(...), withUpdateTimestamp(update));` line, add:

```ts
  if (payload.summary !== undefined && payload.summary !== "") {
    await linkMentions(novelId, volumeId, chapterId, payload.summary);
  }
```

And update `getChapter` to hydrate characters via the same temporary hybrid instead of the `characters: []` placeholder from Task 3 — replace the final `return { ...chapter, characters: [] };` with:

```ts
  const characters =
    data.character_ids.length === 0
      ? []
      : (await fetchNovelCharacters(novelId)).filter((c) => data.character_ids.includes(c.id));
  return { ...chapter, characters: characters as ChapterWithCharacters["characters"] };
```

The `as` cast is needed because `MinimalCharacter` (`{id, name}`) is narrower than the full `Character` type `ChapterWithCharacters.characters` expects (`role`, `aliases`, etc.) — this is acceptable for now because nothing in the current chapter-detail UI (`SummaryRenderer.tsx`, `LinkedCharactersPanel.tsx`) reads any `Character` field beyond `id`/`name` for chapter-linked characters (confirmed: both are pure display components taking `characters` as a prop and rendering name-linked chips). If this changes, fetch full character objects instead of the minimal shape.

- [x] **Step 8: Run to verify it passes**

Run: `cd apps/web && pnpm test chapters.test.ts`
Expected: PASS, including the "does not throw" test; the `it.skip`'d test stays skipped (visible in the test summary as skipped, not failing).

- [x] **Step 9: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors.

- [x] **Step 10: Commit**

```bash
git add apps/web/libs/firebase/mentions.ts apps/web/libs/firebase/mentions.test.ts apps/web/libs/firebase/chapters.ts apps/web/libs/firebase/chapters.test.ts
git commit -m "feat(web): add [[Name]] mention auto-link and character hydration (temporary Go API hybrid)"
```

---

## Task 6: `getLastOrderNos` via Firestore

**Files:**
- Create: `apps/web/libs/firebase/lastOrderNos.ts`
- Create: `apps/web/libs/firebase/lastOrderNos.test.ts`
- Modify: `apps/web/libs/api/index.ts` (replace `getLastOrderNos` body with a re-export)

**Interfaces:**
- Consumes: `db` (from `./app`).
- Produces: `getLastOrderNos(params: { novel_id?: string; volume_id?: string }): Promise<LastOrderNos>`, `type LastOrderNos = { volume: number; chapter: number }` (matches the existing exported `LastOrderNos` interface in `libs/api/index.ts` — re-export it from here).

- [x] **Step 1: Write the failing tests**

`apps/web/libs/firebase/lastOrderNos.test.ts`:

```ts
import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { getLastOrderNos } from "./lastOrderNos";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("getLastOrderNos", () => {
  it("returns 0 for both when neither param matches anything", async () => {
    expect(await getLastOrderNos({})).toEqual({ volume: 0, chapter: 0 });
  });

  it("returns the highest volume number for a novel_id", async () => {
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v1"), { number: 3, title: "A" });
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v2"), { number: 7, title: "B" });

    expect(await getLastOrderNos({ novel_id: "novel-1" })).toEqual({ volume: 7, chapter: 0 });
  });

  it("returns the highest chapter number for a volume_id, via the denormalized volume_id field", async () => {
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c1"),
      { number: 4, title: "A", volume_id: "v1", novel_id: "novel-1" },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c2"),
      { number: 9, title: "B", volume_id: "v1", novel_id: "novel-1" },
    );

    expect(await getLastOrderNos({ volume_id: "v1" })).toEqual({ volume: 0, chapter: 9 });
  });

  it("returns both when both params are given", async () => {
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v1"), { number: 2, title: "A" });
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c1"),
      { number: 5, title: "X", volume_id: "v1", novel_id: "novel-1" },
    );

    expect(await getLastOrderNos({ novel_id: "novel-1", volume_id: "v1" })).toEqual({
      volume: 2,
      chapter: 5,
    });
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm test lastOrderNos.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Write the implementation**

`apps/web/libs/firebase/lastOrderNos.ts`:

```ts
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./app";

export interface LastOrderNos {
  volume: number;
  chapter: number;
}

export async function getLastOrderNos(params: {
  novel_id?: string;
  volume_id?: string;
}): Promise<LastOrderNos> {
  let volume = 0;
  if (params.novel_id) {
    const snapshot = await getDocs(
      query(
        collection(db, "novels", params.novel_id, "volumes"),
        orderBy("number", "desc"),
        limit(1),
      ),
    );
    volume = snapshot.empty ? 0 : (snapshot.docs[0].data() as { number: number }).number;
  }

  let chapter = 0;
  if (params.volume_id) {
    const snapshot = await getDocs(
      query(
        collectionGroup(db, "chapters"),
        where("volume_id", "==", params.volume_id),
        orderBy("number", "desc"),
        limit(1),
      ),
    );
    chapter = snapshot.empty ? 0 : (snapshot.docs[0].data() as { number: number }).number;
  }

  return { volume, chapter };
}
```

This is the query the second composite index added in Task 2's Step 3 (`chapters` collection group, `volume_id ASC, number DESC`) serves — it goes unused until now.

- [x] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test lastOrderNos.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Wire it into `libs/api/index.ts`**

Replace the existing `getLastOrderNos` body and its local `LastOrderNos` interface in `apps/web/libs/api/index.ts` with:

```ts
export { getLastOrderNos } from "@/libs/firebase/lastOrderNos";
export type { LastOrderNos } from "@/libs/firebase/lastOrderNos";
```

At this point every function `libs/api/index.ts` exports is Firestore-backed **except** `getCharacters` and `getCharacterRoles` — confirm those two (and only those two) still call `apiClient` when you review the final file; everything else should now be a re-export line.

- [x] **Step 6: Run the full test suite and linter**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass, no new `tsc` errors. Count the test files: `app.test.ts`, `helpers.test.ts`, `novels.test.ts` (Plan 1) + `tags.test.ts`, `volumes.test.ts`, `chapters.test.ts`, `mentions.test.ts`, `lastOrderNos.test.ts` (this plan) = 8 files.

- [x] **Step 7: Commit**

```bash
git add apps/web/libs/firebase/lastOrderNos.ts apps/web/libs/firebase/lastOrderNos.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate getLastOrderNos from Go API to Firestore"
```

---

## What's Next

This plan covers volumes, chapters, and tags. `characters`, `character_roles`, and `events` — plus the eight files found in Plan 1's research that call the Go API directly instead of through `libs/api` (`AddCharacterForm.tsx`, `CharacterDetail.tsx`, `characters/[characterId]/page.tsx`, `characters/page.tsx`, `novels/[id]/page.tsx`'s inline `getCharacters`, `timeline/page.tsx`, and others) — are Plan 3's scope, along with the Postgres → Firestore data migration script and the repo cutover (removing `apps/api` from `make dev`, dropping the Redis service, updating `CLAUDE.md`/`docs/ai/CONTEXT.md`/`docs/engineering/DECISIONS.md`/`docs/engineering/PROGRESS.md`).

Plan 3 also removes this plan's temporary mention-link/character-hydration hybrid (Task 5) once characters live in Firestore — replace the `fetchNovelCharacters` Go-API call with a direct Firestore characters query, delete the `it.skip`'d cross-service test, and un-skip it against the emulator instead.
