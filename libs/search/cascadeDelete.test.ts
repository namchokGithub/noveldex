import { describe, expect, it } from "vitest";
import { descendantsOf } from "./cascadeDelete";
import type { SearchDocument } from "./types";
const doc = (id: string, type: SearchDocument["type"], volumeId?: string, chapterId?: string): SearchDocument => ({ id, type, novelId: "n", volumeId, chapterId, referenceIds: [], referenceNames: [], referenceTypes: [], aliases: [], tagIds: [], tags: [], route: "/" });
describe("descendantsOf", () => it("retains events while removing deleted chapter records", () => {
  const documents = new Map([doc("chapter", "chapter", "v", "c"), doc("note", "note", "v", "c"), doc("event", "event", "v", "c")].map((item) => [item.id, item]));
  expect(descendantsOf({ type: "chapter", novelId: "n", volumeId: "v", chapterId: "c" }, documents).sort()).toEqual(["chapter", "note"]);
}));
