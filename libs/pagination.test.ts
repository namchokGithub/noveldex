import { describe, expect, it } from "vitest";
import { canNavigatePage } from "./pagination";

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
