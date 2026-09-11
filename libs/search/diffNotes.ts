import type { ChapterNote } from "@/app/types";

export function diffNotes(previous: ChapterNote[], next: ChapterNote[]) {
  const previousById = new Map(previous.map((note) => [note.id, note]));
  const nextIds = new Set(next.map((note) => note.id));
  return {
    changed: next.filter((note) => {
      const previousNote = previousById.get(note.id);
      return !previousNote || previousNote.content !== note.content || previousNote.updated_at !== note.updated_at;
    }),
    removedIds: previous.filter((note) => !nextIds.has(note.id)).map((note) => note.id),
  };
}
