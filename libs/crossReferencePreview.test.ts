import { describe, expect, it } from "vitest";
import { crossReferencePreview } from "./crossReferencePreview";

describe("crossReferencePreview", () => {
  it("shows three items and reports the remaining count", () => {
    expect(crossReferencePreview([1, 2, 3, 4, 5])).toEqual({
      items: [1, 2, 3],
      remaining: 2,
    });
  });
});
