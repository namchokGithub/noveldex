import { describe, expect, it } from "vitest";
import { shouldCancelInlineEdit } from "./inlineEditKeyboard";

describe("shouldCancelInlineEdit", () => {
  it("cancels an idle edit when Escape is pressed", () => {
    expect(shouldCancelInlineEdit("Escape", false)).toBe(true);
  });

  it("does not cancel a busy edit", () => {
    expect(shouldCancelInlineEdit("Escape", true)).toBe(false);
  });
});
