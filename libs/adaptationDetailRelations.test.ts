import { describe, expect, it } from "vitest";
import { linkedEntitiesForAdaptation } from "./adaptationDetailRelations";

describe("linkedEntitiesForAdaptation", () => {
  it("deduplicates resolved story entities and excludes character references", () => {
    const references = [
      {
        start: 0,
        length: 14,
        raw: "[[location:City]]",
        token: {
          status: "resolved" as const,
          reference: {
            entityId: "novel-1:location:city" as const,
            entityType: "location" as const,
            label: "City",
          },
        },
      },
      {
        start: 15,
        length: 7,
        raw: "[[Alice]]",
        token: {
          status: "resolved" as const,
          reference: {
            entityId: "novel-1:character:alice" as const,
            entityType: "character" as const,
            label: "Alice",
          },
        },
      },
    ];

    expect(
      linkedEntitiesForAdaptation({
        notes: [
          { references },
          { references: [references[0]] },
        ],
      }),
    ).toEqual([
      { id: "novel-1:location:city", type: "location", label: "City" },
    ]);
  });
});
