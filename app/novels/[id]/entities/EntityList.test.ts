import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./EntityList.tsx", import.meta.url)),
  "utf8",
);
const addSource = readFileSync(
  fileURLToPath(new URL("./AddEntityForm.tsx", import.meta.url)),
  "utf8",
);
const pageSource = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);

it("returns to the unfiltered entity route from All types", () => {
  expect(source).toContain(
    "const allTypesHref = `/novels/${novelId}/entities?type=all`;",
  );
  expect(source).toContain("href={allTypesHref}");
});

it("remounts the list when pagination navigation provides new data", () => {
  expect(pageSource).toContain(
    'key={`${selectedType ?? "all"}:${cursorHistory.join(",")}`}',
  );
});

it("defaults the entity type filter to location", () => {
  expect(addSource).toContain('defaultValue="location"');
});

it("redirects to the created entity detail page after saving", () => {
  expect(addSource).toContain(
    "router.push(`/novels/${novelId}/entities/${encodeURIComponent(entity.id)}`)",
  );
});
