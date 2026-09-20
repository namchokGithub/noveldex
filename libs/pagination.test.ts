import { describe, expect, it } from "vitest";
import {
  buildCursorPageSearch,
  canNavigatePage,
  normalizeCursorPage,
} from "./pagination";

describe("canNavigatePage", () => {
  it("prevents navigating before the first page", () => {
    expect(canNavigatePage(1, 3, "previous")).toBe(false);
  });

  it("prevents navigating after the last page", () => {
    expect(canNavigatePage(3, 3, "next")).toBe(false);
  });

  it("allows navigation within the page range", () => {
    expect(canNavigatePage(2, 3, "previous")).toBe(true);
    expect(canNavigatePage(2, 3, "next")).toBe(true);
  });
});

describe("normalizeCursorPage", () => {
  it("resets a requested later page without a valid cursor to page one", () => {
    expect(normalizeCursorPage(3, false)).toBe(1);
  });

  it("keeps a positive requested page when a valid cursor is present", () => {
    expect(normalizeCursorPage(3, true)).toBe(3);
  });
});

describe("buildCursorPageSearch", () => {
  it("resets cursor parameters when a page size changes", () => {
    expect(
      buildCursorPageSearch("page=4&per_page=5&after=old&before=older", {
        page: 1,
        perPage: 10,
        cursor: null,
      }),
    ).toBe("page=1&per_page=10");
  });

  it("keeps only the requested navigation cursor", () => {
    expect(
      buildCursorPageSearch("page=2&per_page=5&before=old", {
        page: 3,
        perPage: 5,
        cursor: { name: "after", value: "next" },
      }),
    ).toBe("page=3&per_page=5&after=next");
  });
});
