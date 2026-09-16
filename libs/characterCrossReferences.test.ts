import { describe, expect, it } from "vitest";
import {
  adaptationsForCharacter,
  eventsForCharacter,
} from "./characterCrossReferences";

const aliceReference = {
  start: 0,
  length: 9,
  raw: "[[Alice]]",
  token: {
    status: "resolved" as const,
    reference: {
      entityId: "novel-1:character:alice" as const,
      entityType: "character" as const,
      label: "Alice",
    },
  },
};

describe("character cross references", () => {
  it("keeps events where the character is a participant or persisted reference", () => {
    const events = [
      { id: "manual", character_ids: ["alice"], description_references: [] },
      {
        id: "reference",
        character_ids: [],
        description_references: [aliceReference],
      },
      { id: "other", character_ids: ["bob"], description_references: [] },
    ];

    expect(
      eventsForCharacter(events, "alice").map((event) => event.id),
    ).toEqual(["manual", "reference"]);
  });

  it("keeps adaptations mapped to a character chapter or persisted note reference", () => {
    const adaptations = [
      { id: "mapped", adapted_chapter_ids: ["chapter-1"], notes: [] },
      {
        id: "note-reference",
        adapted_chapter_ids: [],
        notes: [
          {
            id: "note-1",
            content: "",
            character_ids: [],
            references: [aliceReference],
          },
        ],
      },
      { id: "other", adapted_chapter_ids: ["chapter-2"], notes: [] },
    ];

    expect(
      adaptationsForCharacter(adaptations, "alice", new Set(["chapter-1"])).map(
        (adaptation) => adaptation.id,
      ),
    ).toEqual(["mapped", "note-reference"]);
  });
});
