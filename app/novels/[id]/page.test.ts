import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const pageSource = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");

it("does not load characters or generic entities solely for Explore card counts", () => {
  expect(pageSource).not.toContain("getAllCharacters");
  expect(pageSource).not.toContain("getEntities");
  expect(pageSource).not.toContain("novel.trackedCast");
  expect(pageSource).not.toContain("novel.trackedEntities");
});
