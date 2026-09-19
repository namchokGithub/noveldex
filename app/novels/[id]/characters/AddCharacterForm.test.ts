import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "AddCharacterForm.tsx"), "utf8");

it("mounts the character form in a viewport-wide portal", () => {
  expect(source).toContain('import { createPortal } from "react-dom"');
  expect(source).toContain("fullScreenModalBackdropClassName");
  expect(source).toContain("createPortal(");
  expect(source).toContain("document.body");
});
