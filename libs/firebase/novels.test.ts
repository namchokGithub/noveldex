import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createNovel, getNovel, getNovels } from "./novels";
import {
  clearFirestoreEmulator,
  connectFirestoreTestEmulator,
} from "./testUtils";

beforeAll(async () => {
  await connectFirestoreTestEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("novels", () => {
  it("creates a novel with generated id and ISO timestamps", async () => {
    const novel = await createNovel({
      title: "Test Novel",
      author: "Test Author",
      status: "reading",
      description: "A test novel.",
      cover_url: "",
    });

    expect(novel.id).toBeTruthy();
    expect(novel.title).toBe("Test Novel");
    expect(novel.author).toBe("Test Author");
    expect(novel.status).toBe("reading");
    expect(novel.volume_count).toBe(0);
    expect(novel.chapter_count).toBe(0);
    expect(novel.read_count).toBe(0);
    expect(() => new Date(novel.created_at).toISOString()).not.toThrow();
    expect(novel.created_at).toBe(novel.updated_at);

    expect((await getDoc(doc(db, "novels", novel.id))).data()).toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("defaults missing legacy counters to zero", async () => {
    await setDoc(doc(db, "novels", "legacy"), {
      title: "Legacy",
      author: "",
      status: "reading",
      description: "",
      cover_url: "",
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    await expect(getNovel("legacy")).resolves.toMatchObject({
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  });

  it("lists all created novels", async () => {
    await createNovel({
      title: "A",
      author: "",
      status: "reading",
      description: "",
      cover_url: "",
    });
    await createNovel({
      title: "B",
      author: "",
      status: "completed",
      description: "",
      cover_url: "",
    });

    const novels = await getNovels();

    expect(novels).toHaveLength(2);
    expect(novels.map((n) => n.title).sort()).toEqual(["A", "B"]);
  });

  it("gets a single novel by id", async () => {
    const created = await createNovel({
      title: "Solo",
      author: "",
      status: "completed",
      description: "",
      cover_url: "",
    });

    const fetched = await getNovel(created.id);

    expect(fetched).toEqual(created);
  });

  it("throws when the novel does not exist", async () => {
    await expect(getNovel("does-not-exist")).rejects.toThrow();
  });
});
