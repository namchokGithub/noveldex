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
