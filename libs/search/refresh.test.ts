import { describe, expect, it } from "vitest";
import type { Entity } from "@/libs/entities/types";
import { refreshReferenceProjection, refreshTagProjection } from "./refresh";
import type { SearchDocument } from "./types";

const document = (overrides: Partial<SearchDocument> = {}): SearchDocument => ({ id: "note", type: "note", novelId: "n", referenceIds: ["n:character:c"], referenceNames: ["Old"], referenceTypes: ["character"], aliases: ["Old alias"], tagIds: ["tag"], tags: ["Old tag"], route: "/", ...overrides });
const entity: Entity = { id: "n:character:c", novelId: "n", type: "character", name: "Rimuru", aliases: ["Slime"], description: "" };

describe("search projection refresh", () => {
  it("refreshes referenced entity names and aliases", () => expect(refreshReferenceProjection(document(), new Map([[entity.id, entity]]))).toMatchObject({ referenceNames: ["Rimuru"], aliases: ["Slime"] }));
  it("refreshes tag names without changing ids", () => expect(refreshTagProjection(document(), new Map([["tag", "Arc"]]))).toMatchObject({ tagIds: ["tag"], tags: ["Arc"] }));
});
