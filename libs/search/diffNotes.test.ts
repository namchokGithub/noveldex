import { describe, expect, it } from "vitest";
import { diffNotes } from "./diffNotes";
const note = (id: string, content: string) => ({ id, content, created_at: "a", updated_at: content });
describe("diffNotes", () => it("returns changed and removed stable ids", () => {
  expect(diffNotes([note("a", "one"), note("b", "two")], [note("a", "one!"), note("c", "three")])).toMatchObject({ changed: [note("a", "one!"), note("c", "three")], removedIds: ["b"] });
}));
