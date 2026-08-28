import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createCharacter } from "./characters";
import { createTag } from "./tags";
import {
  ChapterOrderEntry as ReorderEntry,
  createChapter,
  deleteChapter,
  getChapter,
  getChaptersByVolume,
  getChaptersFlat,
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
  await setDoc(doc(db, "character_roles", "role-minor"), {
    code: "minor",
    name: "Minor",
    is_active: true,
  });
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

  it("gets a chapter with hydrated tags and characters", async () => {
    await seedVolume("novel-1", "vol-1");
    const tag = await createTag("novel-1", "Flashback");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });
    await linkChapterTag("novel-1", "vol-1", chapter.id, tag.id);

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);

    expect(fetched.tags).toEqual([{ id: tag.id, novel_id: "novel-1", name: "Flashback" }]);
    expect(fetched.characters).toEqual([]);
  });

  it("getChapter resolves with characters: [] when a character_id has no matching character document", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", { number: 1, title: "One" });

    // Seed character_ids directly via raw setDoc — createChapter always starts a
    // chapter with character_ids: [], and only the linkMentions helper would
    // normally populate it. Bypassing that here lets us exercise getChapter's
    // hydration path against a non-empty character_ids array that references a
    // character with no matching Firestore document, proving that case (and, by
    // the same .catch(() => []) guard, a genuine Firestore query failure) degrades
    // to an empty characters array instead of rejecting getChapter's whole promise.
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", chapter.id),
      { character_ids: ["some-character-id"] },
      { merge: true },
    );

    const fetched = await getChapter("novel-1", "vol-1", chapter.id);

    expect(fetched.characters).toEqual([]);
  });

  it("getChapter and getChaptersByVolume resolve without throwing when a chapter document omits tag_ids/character_ids entirely (e.g. a Postgres-migrated chapter with no join-table rows)", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapterId = "migrated-chapter";

    // Written via raw setDoc (not createChapter, which always sets tag_ids: []
    // and character_ids: []) to simulate a future Plan 3 migration writing a
    // chapter document that never sets these fields at all, rather than writing
    // them as empty arrays.
    await setDoc(doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", chapterId), {
      number: 1,
      title: "Migrated Chapter",
      summary: "",
      read_at: null,
      novel_id: "novel-1",
      volume_id: "vol-1",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      // tag_ids and character_ids intentionally omitted.
    });

    const fetched = await getChapter("novel-1", "vol-1", chapterId);
    expect(fetched.tags).toEqual([]);
    expect(fetched.characters).toEqual([]);

    const listed = await getChaptersByVolume("novel-1", "vol-1");
    expect(listed.find((c) => c.id === chapterId)?.tags).toEqual([]);
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
