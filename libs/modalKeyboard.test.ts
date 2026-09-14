import { describe, expect, it } from "vitest";
import { modalKeyboardAction } from "./modalKeyboard";

describe("modalKeyboardAction", () => {
  it("closes an idle modal when Escape is pressed", () => {
    expect(modalKeyboardAction("Escape", false)).toBe("close");
  });

  it("keeps a busy modal open when Escape is pressed", () => {
    expect(modalKeyboardAction("Escape", true)).toBe("none");
  });
});
