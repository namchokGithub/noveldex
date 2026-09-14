import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const volumeManagerSource = readFileSync(
  fileURLToPath(new URL("./[id]/VolumeManager.tsx", import.meta.url)),
  "utf8",
);
const chapterListSource = readFileSync(
  fileURLToPath(
    new URL("./[id]/ChapterListWithFilters.tsx", import.meta.url),
  ),
  "utf8",
);

it("does not render hard-coded delete labels in admin lists", () => {
  expect(volumeManagerSource).not.toMatch(/>\s*Del\s*</);
  expect(chapterListSource).not.toMatch(/>\s*Del\s*</);
  expect(volumeManagerSource).not.toMatch(/>\s*Actions\s*</);
});
