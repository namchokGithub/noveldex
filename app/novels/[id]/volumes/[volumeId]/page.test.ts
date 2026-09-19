import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");

it("loads adjacent volumes and renders volume navigation", () => {
  expect(source).toContain("getAdjacentVolumeMetadata");
  expect(source).toContain('className="flex flex-wrap items-center justify-between gap-3"');
  expect(source).toContain("<VolumeNavigation novelId={id} {...adjacentVolumes} />");
});
