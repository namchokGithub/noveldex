import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
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

    expect((await getDoc(doc(db, "novels", "novel-1", "chapterNumbers", "1"))).exists()).toBe(
      false,
    );
    expect((await getDoc(doc(db, "novels", "novel-1", "chapterNumbers", "2"))).exists()).toBe(
      false,
    );

    await expect(getVolume("novel-1", volume.id)).rejects.toThrow();
    const remaining = await getVolumes("novel-1");
    expect(remaining.summary).toEqual({
      total_volumes: 0,
      total_chapters: 0,
      read_count: 0,
    });
  });
});
