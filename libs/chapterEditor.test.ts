import { describe, expect, it } from "vitest";
import { chapterEditorInitialMode } from "./chapterEditor";

describe("chapterEditorInitialMode", () => {
  it("keeps title, read date, and entry type read-only initially", () => {
    expect(chapterEditorInitialMode()).toEqual({
      title: false,
      readAt: false,
      entry: false,
    });
  });
});
