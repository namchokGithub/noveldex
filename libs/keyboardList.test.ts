import { describe, expect, it } from "vitest";
import { nextListIndex } from "./keyboardList";

describe("nextListIndex", () => {
  it("moves down and wraps to the first option", () => {
    expect(nextListIndex(1, 2, "ArrowDown")).toBe(0);
  });

  it("moves up and wraps to the last option", () => {
    expect(nextListIndex(0, 2, "ArrowUp")).toBe(1);
    expect(nextListIndex(-1, 2, "ArrowUp")).toBe(1);
  });

  it("ignores unrelated keys and empty lists", () => {
    expect(nextListIndex(0, 2, "Enter")).toBe(0);
    expect(nextListIndex(0, 0, "ArrowDown")).toBe(-1);
  });
});
