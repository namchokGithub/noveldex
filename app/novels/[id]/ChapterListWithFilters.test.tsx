import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "ChapterListWithFilters.tsx"), "utf8");

it("renders the reorder trigger in its own sidebar card", () => {
  expect(source).toContain("isAdmin && !reorderMode");
  expect(source).toContain("w-full justify-between");
});
