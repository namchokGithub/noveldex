import { doc, getDoc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createTag } from "./tags";
import {
  ChapterOrderEntry as ReorderEntry,
  createChapter,
  deleteChapter,
  getChapter,
  getChaptersByVolume,
  linkChapterTag,
  reorderChapters,
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

    const rawDoc = await getDoc(
      doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", chapter.id),
    );
    const data = rawDoc.data();
    expect(data?.novel_id).toBe("novel-1");
    expect(data?.volume_id).toBe("vol-1");
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
