import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(import.meta.dirname, "page.tsx"),
  "utf8",
);
const listSource = readFileSync(
  resolve(import.meta.dirname, "CharacterList.tsx"),
  "utf8",
);

it("uses the bounded Character reader and opaque cursor search parameters", () => {
  expect(pageSource).toContain("getCharactersPage");
  expect(pageSource).toContain("resolveCharacterCursorSearch");
  expect(pageSource).toContain("normalizeCursorPage");
  expect(pageSource).toContain("encodeCharacterCursor");
  expect(pageSource).not.toContain("getCharacters(id");
});

it("uses cursor navigation and clears cursors when the page size changes", () => {
  expect(listSource).toContain("buildCursorPageSearch");
  expect(listSource).toContain('name: "before"');
  expect(listSource).toContain('name: "after"');
  expect(listSource).toContain("cursor: null");
});
