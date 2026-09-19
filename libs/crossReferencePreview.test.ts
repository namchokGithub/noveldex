import { describe, expect, it } from "vitest";
import { crossReferencePreview } from "./crossReferencePreview";

describe("crossReferencePreview", () => {
  it("shows five items and reports the remaining count", () => {
    expect(crossReferencePreview([1, 2, 3, 4, 5, 6, 7])).toEqual({
      items: [1, 2, 3, 4, 5],
      remaining: 2,
    });
  });
});
