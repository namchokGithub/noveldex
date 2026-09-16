import { describe, expect, it } from "vitest";
import { chapterPreview } from "./chapterPreview";

describe("chapterPreview", () => {
  it("keeps the first mapped chapter visible and sends later chapters to the dialog", () => {
    expect(chapterPreview(["chapter-1", "chapter-2", "chapter-3"])).toEqual({
      visibleId: "chapter-1",
      hiddenIds: ["chapter-2", "chapter-3"],
    });
  });
});
