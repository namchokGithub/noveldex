import { describe, expect, it } from "vitest";
import { extractReferenceTokens, resolveReferenceOccurrences, type EntityLookup } from "./references";
import type { Entity } from "./types";

const rimuru: Entity = { id: "n:character:c", novelId: "n", type: "character", name: "Rimuru", aliases: ["Slime"], description: "" };
const tempest: Entity = { id: "n:location:l", novelId: "n", type: "location", name: "Tempest", aliases: [], description: "" };
const lookup: EntityLookup = { findByName: async (novelId, name, type) => [rimuru, tempest].filter((entity) => entity.novelId === novelId && entity.type === type && [entity.name, ...entity.aliases].some((candidate) => candidate.toLowerCase() === name.trim().toLowerCase())) };

describe("entity references", () => {
  it("parses typed, untyped, and plain text", () => {
    expect(extractReferenceTokens("[[Rimuru]] [[location:Tempest]] plain").map((token) => [token.typed, token.label])).toEqual([[null, "Rimuru"], ["location", "Tempest"]]);
  });
  it("resolves untyped syntax as character only and supports aliases", async () => {
    const [character, location] = await resolveReferenceOccurrences("n", "[[Slime]] [[location:Tempest]]", lookup);
    expect(character.token).toMatchObject({ status: "resolved", reference: { entityId: rimuru.id } });
    expect(location.token).toMatchObject({ status: "resolved", reference: { entityId: tempest.id } });
  });
});
