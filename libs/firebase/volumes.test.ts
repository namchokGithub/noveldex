import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createVolume,
  decodeVolumeCursor,
  encodeVolumeCursor,
  deleteVolume,
  getAdjacentVolumeMetadata,
  getVolume,
  getVolumesPage,
  updateVolume,
} from "./volumes";
import { createAdaptation, getAdaptationsByVolume } from "./adaptations";
import { createChapter, updateChapter } from "./chapters";
import {
  clearFirestoreEmulator,
  connectFirestoreTestEmulator,
} from "./testUtils";

beforeAll(async () => {
  await connectFirestoreTestEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
  await setDoc(doc(db, "novels", "novel-1"), {
    title: "Novel One",
    author: "Author",
    status: "reading",
    description: "",
    cover_url: "",
    volume_count: 0,
    chapter_count: 0,
    read_count: 0,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
});

async function seedChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  number: number,
  read: boolean,
  kind: "chapter" | "prologue" = "chapter",
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId),
    {
      number,
      kind,
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
  await setDoc(
    doc(
      db,
      "novels",
      novelId,
      "volumes",
      volumeId,
      "chapterNumbers",
      String(number),
    ),
    {
      chapter_id: chapterId,
    },
  );
  if (kind === "chapter") {
    const counters = {
      chapter_count: increment(1),
      ...(read ? { read_count: increment(1) } : {}),
    };
    await updateDoc(doc(db, "novels", novelId), counters);
    await updateDoc(doc(db, "novels", novelId, "volumes", volumeId), counters);
  }
}

describe("volumes", () => {
  it("creates a volume with generated id, timestamps, and zeroed counts", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });

    expect(volume.id).toBeTruthy();
    expect(volume.novel_id).toBe("novel-1");
    expect(volume.number).toBe(1);
    expect(volume.title).toBe("Volume One");
    expect(volume.chapter_count).toBe(0);
    expect(volume.read_count).toBe(0);
    expect(volume.created_at).toBe(volume.updated_at);

    expect(
      (await getDoc(doc(db, "novels", "novel-1", "volumes", volume.id))).data(),
    ).toMatchObject({
      chapter_count: 0,
      read_count: 0,
    });
    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 1,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("persists an optional source image URL", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
      source_img_url: "https://images.example.com/volume-one.jpg",
    });

    expect(volume.source_img_url).toBe(
      "https://images.example.com/volume-one.jpg",
    );
  });

  it("computes chapter_count and read_count for a single volume from its chapters", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    await seedChapter("novel-1", volume.id, "ch-1", 1, true);
    await seedChapter("novel-1", volume.id, "ch-2", 2, false);

    const fetched = await getVolume("novel-1", volume.id);

    expect(fetched.chapter_count).toBe(2);
    expect(fetched.read_count).toBe(1);
  });

  it("paginates duplicate numbers with opaque cursors and stored Novel counters", async () => {
    const now = Timestamp.now();
    const volumeDocs = [
      { id: "volume-1", number: 1, chapter_count: 1, read_count: 0 },
      { id: "volume-2a", number: 2, chapter_count: 2, read_count: 1 },
      { id: "volume-2b", number: 2, chapter_count: 3, read_count: 2 },
      { id: "volume-3", number: 3, chapter_count: 4, read_count: 3 },
    ];
    for (const volume of volumeDocs) {
      await setDoc(doc(db, "novels", "novel-1", "volumes", volume.id), {
        ...volume,
        title: volume.id,
        title_en: volume.id,
        title_th: "",
        description: "",
        source_img_url: null,
        created_at: now,
        updated_at: now,
      });
    }
    await updateDoc(doc(db, "novels", "novel-1"), {
      volume_count: 4,
      chapter_count: 10,
      read_count: 6,
    });

    const first = await getVolumesPage("novel-1", { page: 1, perPage: 2 });
    const second = await getVolumesPage("novel-1", {
      page: 2,
      perPage: 2,
      after: first.nextCursor,
    });
    const previous = await getVolumesPage("novel-1", {
      page: 1,
      perPage: 2,
      before: second.previousCursor,
    });
    const malformedCursor = await getVolumesPage("novel-1", {
      page: 3,
      perPage: 2,
      after: decodeVolumeCursor("not-a-volume-cursor"),
    });

    expect(first.items.map((volume) => volume.id)).toEqual([
      "volume-1",
      "volume-2a",
    ]);
    expect(second.items.map((volume) => volume.id)).toEqual([
      "volume-2b",
      "volume-3",
    ]);
    expect(previous.items.map((volume) => volume.id)).toEqual([
      "volume-1",
      "volume-2a",
    ]);
    expect(
      [...first.items, ...second.items].map((volume) => volume.id),
    ).toEqual(["volume-1", "volume-2a", "volume-2b", "volume-3"]);
    expect(first.novel).toMatchObject({
      volume_count: 4,
      chapter_count: 10,
      read_count: 6,
    });
    expect(first.items.map((volume) => volume.chapter_count)).toEqual([1, 2]);
    expect(first.items.map((volume) => volume.read_count)).toEqual([0, 1]);
    expect(first.pagination).toMatchObject({ page: 1, per_page: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.previousCursor).toBeNull();
    expect(previous.previousCursor).toBeNull();
    expect(malformedCursor.items.map((volume) => volume.id)).toEqual([
      "volume-1",
      "volume-2a",
    ]);
    expect(malformedCursor.pagination.page).toBe(1);
  });

  it("encodes and rejects malformed volume cursors", () => {
    expect(
      decodeVolumeCursor(encodeVolumeCursor({ number: 2, id: "volume-2a" })),
    ).toEqual({ number: 2, id: "volume-2a" });
    expect(decodeVolumeCursor('{"number":"2","id":"volume-2a"}')).toBeNull();
    expect(decodeVolumeCursor('{"number":2,"id":""}')).toBeNull();
  });

  it("finds only the immediately adjacent volumes by number", async () => {
    const first = await createVolume("novel-1", { number: 1, title: "One" });
    const third = await createVolume("novel-1", { number: 3, title: "Three" });
    const fifth = await createVolume("novel-1", { number: 5, title: "Five" });

    await expect(
      getAdjacentVolumeMetadata("novel-1", 3),
    ).resolves.toMatchObject({
      previous: expect.objectContaining({ id: first.id, number: 1 }),
      next: expect.objectContaining({ id: fifth.id, number: 5 }),
    });
    await expect(
      getAdjacentVolumeMetadata("novel-1", 1),
    ).resolves.toMatchObject({
      previous: null,
      next: expect.objectContaining({ id: third.id, number: 3 }),
    });
  });

  it("excludes read special entries from volume and novel read counts", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    await seedChapter("novel-1", volume.id, "chapter-1", 1, true);
    await seedChapter("novel-1", volume.id, "prologue-1", 0, true, "prologue");

    const result = await getVolumesPage("novel-1");

    expect(result.items[0]).toMatchObject({
      chapter_count: 1,
      read_count: 1,
    });
    expect(result.novel).toMatchObject({
      chapter_count: 1,
      read_count: 1,
    });
  });

  it("defaults page to 1 and per_page to 5, falling back on an unsupported per_page", async () => {
    await createVolume("novel-1", { number: 1, title: "Volume One" });

    const result = await getVolumesPage("novel-1", { perPage: 999 });

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.per_page).toBe(5);
  });

  it("updates a volume's number and title", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Old Title",
    });

    const updated = await updateVolume("novel-1", volume.id, {
      number: 2,
      title: "New Title",
    });

    expect(updated.number).toBe(2);
    expect(updated.title).toBe("New Title");
  });

  it("creates and updates a volume description, defaulting to an empty string", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
      description: "A quiet arrival.",
    });
    expect(volume.description).toBe("A quiet arrival.");

    const withoutDescription = await createVolume("novel-1", {
      number: 2,
      title: "Volume Two",
    });
    expect(withoutDescription.description).toBe("");

    const updated = await updateVolume("novel-1", volume.id, {
      description: "Revised opening.",
    });
    expect(updated.description).toBe("Revised opening.");
    expect(updated.title).toBe("Volume One");
    expect(updated.number).toBe(1);
  });

  it("accepts a 1000-character volume description and rejects a longer one", async () => {
    await expect(
      createVolume("novel-1", {
        number: 1,
        title: "Volume One",
        description: "x".repeat(1000),
      }),
    ).resolves.toMatchObject({ description: "x".repeat(1000) });

    await expect(
      createVolume("novel-1", {
        number: 2,
        title: "Volume Two",
        description: "x".repeat(1001),
      }),
    ).rejects.toThrow("description must be 1000 characters or fewer");
  });

  it("throws when getting a volume that does not exist", async () => {
    await expect(getVolume("novel-1", "does-not-exist")).rejects.toThrow();
  });

  it("deletes a volume and cascades to its chapters and their number markers", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    await seedChapter("novel-1", volume.id, "ch-1", 1, false);
    await seedChapter("novel-1", volume.id, "ch-2", 2, false);

    await deleteVolume("novel-1", volume.id);

    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });

    expect(
      (
        await getDoc(
          doc(
            db,
            "novels",
            "novel-1",
            "volumes",
            "vol-1",
            "chapterNumbers",
            "1",
          ),
        )
      ).exists(),
    ).toBe(false);
    expect(
      (
        await getDoc(
          doc(
            db,
            "novels",
            "novel-1",
            "volumes",
            "vol-1",
            "chapterNumbers",
            "2",
          ),
        )
      ).exists(),
    ).toBe(false);

    await expect(getVolume("novel-1", volume.id)).rejects.toThrow();
    const remaining = await getVolumesPage("novel-1");
    expect(remaining.novel).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("does not decrement volume_count when an already-deleted volume is deleted again", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });

    await deleteVolume("novel-1", volume.id);
    await deleteVolume("novel-1", volume.id);

    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("decrements novel counters across multiple chapter deletion batches", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    const seedBatch = writeBatch(db);
    for (let number = 1; number <= 201; number += 1) {
      seedBatch.set(
        doc(
          db,
          "novels",
          "novel-1",
          "volumes",
          volume.id,
          "chapters",
          `ch-${number}`,
        ),
        {
          number,
          kind: number % 5 === 0 ? "prologue" : "chapter",
          read_at: number <= 101 ? Timestamp.now() : null,
          novel_id: "novel-1",
          volume_id: volume.id,
        },
      );
    }
    await seedBatch.commit();
    await setDoc(
      doc(db, "novels", "novel-1"),
      { chapter_count: 161, read_count: 81 },
      { merge: true },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id),
      { chapter_count: 161, read_count: 81 },
      { merge: true },
    );

    await deleteVolume("novel-1", volume.id);

    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
    expect(
      (
        await getDoc(doc(db, "novels", "novel-1", "volumes", volume.id))
      ).exists(),
    ).toBe(false);
  });

  it("uses transaction-current chapter state for a later deletion chunk", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    for (let start = 1; start <= 1_001; start += 400) {
      const seedBatch = writeBatch(db);
      for (
        let number = start;
        number < start + 400 && number <= 1_001;
        number += 1
      ) {
        const chapterId = number === 1_001 ? "zz-interleaved" : `ch-${number}`;
        seedBatch.set(
          doc(
            db,
            "novels",
            "novel-1",
            "volumes",
            volume.id,
            "chapters",
            chapterId,
          ),
          {
            number,
            kind: "chapter",
            title: `Chapter ${number}`,
            title_en: `Chapter ${number}`,
            summary: "",
            notes: [],
            read_at: null,
            novel_id: "novel-1",
            volume_id: volume.id,
            tag_ids: [],
            character_ids: [],
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
          },
        );
      }
      await seedBatch.commit();
    }
    await setDoc(
      doc(db, "novels", "novel-1"),
      { chapter_count: 1_001, read_count: 0 },
      { merge: true },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id),
      { chapter_count: 1_001, read_count: 0 },
      { merge: true },
    );

    const deletion = deleteVolume("novel-1", volume.id);
    const firstChapterRef = doc(
      db,
      "novels",
      "novel-1",
      "volumes",
      volume.id,
      "chapters",
      "ch-1",
    );
    let firstChunkCommitted = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!(await getDoc(firstChapterRef)).exists()) {
        firstChunkCommitted = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(firstChunkCommitted).toBe(true);

    let mutationError: unknown;
    try {
      await updateChapter("novel-1", volume.id, "zz-interleaved", {
        kind: "prologue",
      });
    } catch (error) {
      mutationError = error;
    }
    await deletion;
    if (mutationError) throw mutationError;

    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("blocks a chapter created after deletion scanning begins without orphaning counters", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    for (let start = 1; start <= 1_001; start += 400) {
      const seedBatch = writeBatch(db);
      for (
        let number = start;
        number < start + 400 && number <= 1_001;
        number += 1
      ) {
        seedBatch.set(
          doc(
            db,
            "novels",
            "novel-1",
            "volumes",
            volume.id,
            "chapters",
            `ch-${number}`,
          ),
          {
            number,
            kind: "chapter",
            title: `Chapter ${number}`,
            title_en: `Chapter ${number}`,
            summary: "",
            notes: [],
            read_at: null,
            novel_id: "novel-1",
            volume_id: volume.id,
            tag_ids: [],
            character_ids: [],
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
          },
        );
      }
      await seedBatch.commit();
    }
    await setDoc(
      doc(db, "novels", "novel-1"),
      { chapter_count: 1_001, read_count: 0 },
      { merge: true },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id),
      { chapter_count: 1_001, read_count: 0 },
      { merge: true },
    );

    const deletion = deleteVolume("novel-1", volume.id);
    const firstChapterRef = doc(
      db,
      "novels",
      "novel-1",
      "volumes",
      volume.id,
      "chapters",
      "ch-1",
    );
    let firstChunkCommitted = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!(await getDoc(firstChapterRef)).exists()) {
        firstChunkCommitted = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(firstChunkCommitted).toBe(true);

    const deletingVolume = await getDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id),
    );
    expect(deletingVolume.data()).toMatchObject({ deleting: true });
    await expect(
      createChapter("novel-1", volume.id, {
        number: 1_002,
        title_en: "Interleaved chapter",
      }),
    ).rejects.toThrow("Volume is being deleted.");

    await deletion;

    expect(
      (
        await getDocs(
          collection(db, "novels", "novel-1", "volumes", volume.id, "chapters"),
        )
      ).empty,
    ).toBe(true);
    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("does not decrement counters for a legacy chapter with no persisted kind", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id, "chapters", "legacy"),
      {
        number: 1,
        read_at: Timestamp.now(),
        novel_id: "novel-1",
        volume_id: volume.id,
      },
    );
    await setDoc(
      doc(db, "novels", "novel-1"),
      { chapter_count: 0, read_count: 0 },
      { merge: true },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", volume.id),
      { chapter_count: 0, read_count: 0 },
      { merge: true },
    );

    await deleteVolume("novel-1", volume.id);

    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("deletes a legacy volume with regular chapters and absent volume counters", async () => {
    const volumeRef = doc(db, "novels", "novel-1", "volumes", "legacy-volume");
    await setDoc(volumeRef, {
      number: 1,
      title: "Legacy Volume",
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
    await setDoc(doc(volumeRef, "chapters", "chapter-1"), {
      number: 1,
      kind: "chapter",
      read_at: null,
      novel_id: "novel-1",
      volume_id: "legacy-volume",
    });
    await updateDoc(doc(db, "novels", "novel-1"), {
      volume_count: 1,
      chapter_count: 1,
    });

    await deleteVolume("novel-1", "legacy-volume");

    expect((await getDoc(volumeRef)).exists()).toBe(false);
    expect((await getDoc(doc(db, "novels", "novel-1"))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("deletes adaptations before deleting their volume", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
    });
    await createAdaptation("novel-1", volume.id, {
      medium: "anime",
      group_label: "Season 1",
      group_sort_order: 1,
      entry_type: "episode",
      entry_number: 1,
      title: "Episode 1",
    });

    await deleteVolume("novel-1", volume.id);

    expect(await getAdaptationsByVolume("novel-1", volume.id)).toEqual([]);
  });
});
