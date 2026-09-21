import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");

it("loads adjacent volumes and renders volume navigation", () => {
  expect(source).toContain("getAdjacentVolumeMetadata");
  expect(source).toContain(
    'className="flex flex-wrap items-center justify-between gap-3"',
  );
  expect(source).toContain(
    "<VolumeNavigation novelId={id} {...adjacentVolumes} />",
  );
  expect(source).toContain("<RecentNovelPageTracker");
  expect(source).toMatch(
    /label=\{volumeRecentPageLabel\(\s*volume\.number,\s*volume\.title_en \|\| volume\.title,\s*\)\}/,
  );
});

it("derives the volume tag filter from loaded chapters instead of all novel tags", () => {
  expect(source).not.toContain("getTags");
  expect(source).toContain("const availableTags = chapters");
});

it("places adaptations above the chapter tag filter sidebar", () => {
  expect(source).toContain("sidebar={");
  expect(source).toContain("<AdaptationSection");
  expect(source.indexOf("sidebar={")).toBeLessThan(
    source.indexOf("<AdaptationSection"),
  );
});

it("does not render a separate chapters summary below adaptations", () => {
  expect(source).not.toContain('k="volume.chapters"');
  expect(source).not.toContain("chapterCount === 1");
});

it("loads only the latest adaptation and omits the volume overview", () => {
  expect(source).toContain("getLatestAdaptationByVolume");
  expect(source).not.toContain("getAdaptationsByVolume");
  expect(source).not.toContain("VolumeOverview");
});
