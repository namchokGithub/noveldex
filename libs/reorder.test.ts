import { describe, expect, it } from "vitest";
import { moveListItem } from "./reorder";

describe("moveListItem", () => {
  it("moves an item up one position", () => {
    expect(moveListItem(["one", "two", "three"], 1, 0)).toEqual([
      "two",
      "one",
      "three",
    ]);
  });

  it("leaves an out-of-range move unchanged", () => {
    expect(moveListItem(["one", "two"], 0, -1)).toEqual(["one", "two"]);
  });
});
