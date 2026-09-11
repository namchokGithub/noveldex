import { describe, expect, it } from "vitest";
import { reconcileReferenceOccurrences } from "./reconcile";
import type { EntityLookup } from "./references";

const lookup: EntityLookup = { findByName: async () => [{ id: "n:character:c", novelId: "n", type: "character", name: "Rimuru", aliases: [], description: "" }] };

describe("reference reconciliation", () => {
  it("keeps a binding when unrelated prose changes", async () => {
    const first = await reconcileReferenceOccurrences("n", "[[Rimuru]] wakes.", null, lookup);
    const second = await reconcileReferenceOccurrences("n", "[[Rimuru]] wakes again.", { content: "[[Rimuru]] wakes.", occurrences: first }, { findByName: async () => [] });
    expect(second[0].token).toEqual(first[0].token);
  });
});
