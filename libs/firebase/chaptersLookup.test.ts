import { doc, setDoc, Timestamp } from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getAllCharactersCallCount } = vi.hoisted(() => ({
  getAllCharactersCallCount: { value: 0 },
}));

vi.mock("./characters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./characters")>();
  return {
    ...actual,
    getAllCharacters: async (...args: Parameters<typeof actual.getAllCharacters>) => {
      getAllCharactersCallCount.value += 1;
      return actual.getAllCharacters(...args);
    },
  };
});

import { db } from "./app";
import { createCharacter } from "./characters";
import { getChaptersByVolume, getChaptersFlatDetailed } from "./chapters";
import {
  clearFirestoreEmulator,
  connectFirestoreTestEmulator,
} from "./testUtils";

beforeAll(async () => {
  await connectFirestoreTestEmulator();
});

beforeEach(async () => {
  getAllCharactersCallCount.value = 0;
  await clearFirestoreEmulator();
  await setDoc(doc(db, "character_roles", "role-minor"), {
    code: "minor",
    name: "Minor",
    is_active: true,
  });
  await setDoc(doc(db, "novels", "novel-1"), {
    character_count: 0,
    volume_count: 0,
    chapter_count: 0,
    read_count: 0,
  });
});

describe("getChaptersByVolume legacy references", () => {
  it("shares entity lookup work across every chapter in the volume", async () => {
    await createCharacter("novel-1", {
      name: "Rimuru",
      role: "minor",
      description: "",
      aliases: [],
    });
    const timestamp = Timestamp.now();
    for (const chapterId of ["legacy-one", "legacy-two"]) {
      await setDoc(
        doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", chapterId),
        {
          number: chapterId === "legacy-one" ? 1 : 2,
          title_en: chapterId,
          summary: "",
          notes: [{ id: `${chapterId}-note`, content: "[[Rimuru]] appears.", character_ids: [], created_at: timestamp, updated_at: timestamp }],
          read_at: null,
          novel_id: "novel-1",
          volume_id: "vol-1",
          tag_ids: [],
          character_ids: [],
          created_at: timestamp,
          updated_at: timestamp,
        },
      );
    }

    for (const readChapters of [
      () => getChaptersByVolume("novel-1", "vol-1"),
      () => getChaptersFlatDetailed("novel-1"),
    ]) {
      getAllCharactersCallCount.value = 0;
      const chapters = await readChapters();

      expect(chapters.flatMap((chapter) => chapter.notes[0]?.references ?? [])).toHaveLength(2);
      expect(getAllCharactersCallCount.value).toBe(1);
    }
  });
});
