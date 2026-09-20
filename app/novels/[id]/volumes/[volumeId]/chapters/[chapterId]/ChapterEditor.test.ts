import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "ChapterEditor.tsx"), "utf8");

it("clears a saved read date by persisting null", () => {
  expect(source).toContain("async function saveReadAt(value = readAt)");
  expect(source).toContain("read_at: normalizeDateTimeLocalToISOString(value)");
  expect(source).toContain("onClick={() => void saveReadAt(\"\")}");
  expect(source).toContain('{t("chapter.clearDate")}');
});
