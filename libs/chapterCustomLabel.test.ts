import { expect, it } from "vitest";
import { customLabelForKind } from "./chapterCustomLabel";

it("defaults a new other entry to Interlude", () => {
  expect(customLabelForKind("other", "")).toBe("Interlude");
});

it("preserves a custom label the user already entered", () => {
  expect(customLabelForKind("other", "Bonus Scene")).toBe("Bonus Scene");
});
