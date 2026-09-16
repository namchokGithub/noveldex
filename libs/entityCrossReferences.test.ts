import { describe, expect, it } from "vitest";
import {
  adaptationsForEntity,
  eventsForEntity,
  notesForEntity,
} from "./entityCrossReferences";

const cityReference = {
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
};

describe("entity cross references", () => {
  it("keeps only chapter notes with the exact persisted entity reference", () => {
    const chapters = [
      {
        id: "chapter-1",
        notes: [
          { id: "city-note", content: "In the city.", references: [cityReference] },
          { id: "other-note", content: "Elsewhere.", references: [] },
        ],
      },
    ];

    expect(notesForEntity(chapters, "novel-1:location:city")).toEqual([
      {
        chapter: chapters[0],
        note: chapters[0].notes[0],
      },
    ]);
  });

  it("keeps events and adaptations linked through persisted references or mapped chapters", () => {
    const events = [
      { id: "event-city", description_references: [cityReference] },
      { id: "event-other", description_references: [] },
    ];
    const adaptations = [
      { id: "mapped", adapted_chapter_ids: ["chapter-1"], notes: [] },
      {
        id: "noted",
        adapted_chapter_ids: [],
        notes: [{ id: "note", content: "", references: [cityReference] }],
      },
      { id: "other", adapted_chapter_ids: ["chapter-2"], notes: [] },
    ];

    expect(eventsForEntity(events, "novel-1:location:city").map((event) => event.id)).toEqual([
      "event-city",
    ]);
    expect(
      adaptationsForEntity(
        adaptations,
        "novel-1:location:city",
        new Set(["chapter-1"]),
      ).map((adaptation) => adaptation.id),
    ).toEqual(["mapped", "noted"]);
  });
});
