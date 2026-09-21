import { expect, it } from "vitest";
import { titleForChapterKind } from "./chapterDefaultTitle";

it("defaults a new afterword title to Fuse", () => {
  expect(titleForChapterKind("afterword", "")).toBe("Fuse");
});

it("preserves a title the user already entered", () => {
  expect(titleForChapterKind("afterword", "Afterword")).toBe("Afterword");
});
