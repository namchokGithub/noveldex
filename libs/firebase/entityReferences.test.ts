import { describe, expect, it } from "vitest";
import type { ReferenceOccurrence } from "@/libs/entities/references";
import {
  entityReferenceId,
  referencesForChapterNotes,
  referencesForEvent,
} from "./entityReferences";

const resolved = (entityId: string): ReferenceOccurrence => ({
  start: 0,
  length: 10,
  raw: "[[place]]",
  token: {
    status: "resolved",
    reference: { entityId, entityType: "location", label: "Place" },
  },
});

describe("entity references", () => {
  it("indexes a resolved entity once per chapter note", () => {
    const entries = referencesForChapterNotes({
      sourceId: "chapter-1",
      volumeId: "volume-1",
      title: "Arrival",
      sortOrder: 1,
      updatedAt: "2026-09-23T00:00:00.000Z",
      notes: [
        {
          id: "note-1",
          content: "[[location:Place]] twice",
          references: [
            resolved("novel-1:location:place-1"),
            resolved("novel-1:location:place-1"),
            {
              start: 0,
              length: 8,
              raw: "[[none]]",
              token: { status: "unresolved", typed: "location", label: "None" },
            },
          ],
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: entityReferenceId({
          sourceType: "chapter_note",
          sourceId: "chapter-1",
          noteId: "note-1",
          entityId: "novel-1:location:place-1",
        }),
        entity_id: "novel-1:location:place-1",
        source_type: "chapter_note",
        preview: "[[location:Place]] twice",
      }),
    ]);
  });

  it("does not index unresolved event references", () => {
    expect(
      referencesForEvent({
        eventId: "event-1",
        title: "Arrival",
        sortOrder: 1,
        updatedAt: "2026-09-23T00:00:00.000Z",
        references: [
          {
            start: 0,
            length: 8,
            raw: "[[none]]",
            token: { status: "unresolved", typed: "location", label: "None" },
          },
        ],
      }),
    ).toEqual([]);
  });
});
