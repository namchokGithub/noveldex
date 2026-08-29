import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createNovel, getNovel, getNovels } from "./novels";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
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
    expect(() => new Date(novel.created_at).toISOString()).not.toThrow();
    expect(novel.created_at).toBe(novel.updated_at);
  });

  it("lists all created novels", async () => {
    await createNovel({ title: "A", author: "", status: "reading", description: "", cover_url: "" });
    await createNovel({ title: "B", author: "", status: "completed", description: "", cover_url: "" });

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
