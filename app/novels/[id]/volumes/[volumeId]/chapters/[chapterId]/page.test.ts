import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");

it("provides the full novel character catalog to chapter note previews", () => {
  expect(source).toContain("let noteCharacters;");
  expect(source).toContain("noteCharacters = characters;");
  expect(source).toContain("characters={noteCharacters}");
});
