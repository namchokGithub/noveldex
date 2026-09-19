import { describe, expect, it } from "vitest";
import type { Entity } from "@/libs/entities/types";
import {
  filterEntityReferences,
  paginateEntityReferences,
} from "./entityPicker";

const entities: Entity[] = [
  { id: "n:character:rimuru", novelId: "n", type: "character", name: "Rimuru Tempest", aliases: ["Slime"], description: "" },
  { id: "n:organization:jura", novelId: "n", type: "organization", name: "Jura-Tempest Federation", aliases: ["Tempest"], description: "" },
  ...Array.from({ length: 10 }, (_, index) => ({ id: `n:skill:${index}`, novelId: "n", type: "skill" as const, name: `Skill ${index}`, aliases: [], description: "" })),
];

describe("entity reference picker", () => {
  it("filters by type, name, and aliases", () => {
    expect(filterEntityReferences(entities, "organization", "tempest").map(({ id }) => id)).toEqual(["n:organization:jura"]);
    expect(filterEntityReferences(entities, "all", "slime").map(({ id }) => id)).toEqual(["n:character:rimuru"]);
  });

  it("returns ten entities per page", () => {
    const page = paginateEntityReferences(entities, 2);
    expect(page.totalPages).toBe(2);
    expect(page.items).toHaveLength(2);
  });
});
