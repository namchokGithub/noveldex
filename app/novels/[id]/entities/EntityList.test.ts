import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./EntityList.tsx", import.meta.url)),
  "utf8",
);
const pageSource = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);

it("returns to the unfiltered entity route from All types", () => {
  expect(source).toContain(
    "const allTypesHref = `/novels/${novelId}/entities`;",
  );
  expect(source).toContain("href={allTypesHref}");
});

it("remounts the list when pagination navigation provides new data", () => {
  expect(pageSource).toContain(
    'key={`${selectedType ?? "all"}:${cursorHistory.join(",")}`}',
  );
});
