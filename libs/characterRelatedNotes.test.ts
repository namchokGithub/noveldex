import { describe, expect, it } from "vitest";
import { relatedNotesForCharacter } from "./characterRelatedNotes";

describe("relatedNotesForCharacter", () => {
  it("keeps only notes that reference the selected character", () => {
    expect(
      relatedNotesForCharacter(
        [
          {
            id: "chapter-1",
            notes: [
              { id: "note-alice", content: "Alice arrives.", character_ids: ["alice"] },
              { id: "note-bob", content: "Bob leaves.", character_ids: ["bob"] },
            ],
          },
          {
            id: "chapter-2",
            notes: [{ id: "note-both", content: "Alice meets Bob.", character_ids: ["alice", "bob"] }],
          },
        ],
        "alice",
      ),
    ).toEqual([
      { chapterId: "chapter-1", note: { id: "note-alice", content: "Alice arrives." } },
      { chapterId: "chapter-2", note: { id: "note-both", content: "Alice meets Bob." } },
    ]);
  });
});
