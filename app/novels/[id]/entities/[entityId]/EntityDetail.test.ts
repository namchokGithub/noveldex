import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./EntityDetail.tsx", import.meta.url)),
  "utf8",
);

it("keeps entity edit actions together below the fields", () => {
  expect(source).toContain(
    'className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5"',
  );
});

it("uses a destructive red treatment for the entity delete action", () => {
  expect(source).toContain("text-rose-700");
  expect(source).toContain("hover:bg-rose-50");
});

it("uses translation keys for the entity type and delete confirmation", () => {
  expect(source).toContain("command.resultType.${entity.type}");
  expect(source).toContain('t("entities.deleteEyebrow")');
  expect(source).toContain('t("entities.deleteTitle", { name: entity.name })');
  expect(source).toContain('t("entities.deleteDescription")');
});
