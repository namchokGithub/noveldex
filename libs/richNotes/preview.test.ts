import { describe, expect, it } from "vitest";
import type { Entity } from "@/libs/entities/types";
import { genericEntityHref, resolveGenericReference } from "./preview";

const entities: Entity[] = [
  { id: "novel-1:location:tempest", novelId: "novel-1", type: "location", name: "Jura-Tempest Federation", aliases: ["Tempest"], description: "" },
  { id: "novel-1:skill:tempest", novelId: "novel-1", type: "skill", name: "Tempest", aliases: [], description: "" },
  { id: "novel-1:item:mask-a", novelId: "novel-1", type: "item", name: "Mask A", aliases: ["Mask"], description: "" },
  { id: "novel-1:item:mask-b", novelId: "novel-1", type: "item", name: "Mask B", aliases: ["Mask"], description: "" },
];

describe("generic rich-note references", () => {
  it("resolves a typed generic entity by name or alias", () => {
    expect(resolveGenericReference(entities, "location", "Jura-Tempest Federation")?.id).toBe("novel-1:location:tempest");
    expect(resolveGenericReference(entities, "location", "Tempest")?.id).toBe("novel-1:location:tempest");
  });

  it("does not resolve a type mismatch or ambiguous alias", () => {
    expect(resolveGenericReference(entities, "organization", "Tempest")).toBeNull();
    expect(resolveGenericReference(entities, "item", "Mask")).toBeNull();
  });

  it("builds an encoded internal entity URL", () => {
    expect(genericEntityHref("novel-1", { ...entities[0], id: "novel-1:location:tempest/south" })).toBe("/novels/novel-1/entities/novel-1%3Alocation%3Atempest%2Fsouth");
  });
});
