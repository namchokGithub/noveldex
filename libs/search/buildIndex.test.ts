import { describe, expect, it } from "vitest";
import { buildIndex } from "./buildIndex";
import type { SearchDocument } from "./types";

function doc(overrides: Partial<SearchDocument>): SearchDocument {
  return { id: "d1", type: "novel", novelId: "n1", referenceIds: [], referenceNames: [], referenceTypes: [], aliases: [], tagIds: [], tags: [], route: "/", ...overrides };
}

describe("buildIndex", () => {
  it("indexes array fields without storing result data", () => {
    const index = buildIndex([doc({ tags: ["Flashback"] })]);
    expect(index.search("Flashback")).toHaveLength(1);
    expect(index.search("Flashback")[0].title).toBeUndefined();
  });

  it("supports incremental add, replace, and discard", () => {
    const index = buildIndex([]);
    index.add(doc({ title: "Alpha" }));
    index.replace(doc({ title: "Beta" }));
    expect(index.search("Alpha")).toHaveLength(0);
    index.discard("d1");
    expect(index.search("Beta")).toHaveLength(0);
  });
});
