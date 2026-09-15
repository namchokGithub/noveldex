export interface CharacterRelatedNoteInput {
  id: string;
  notes?: Array<{
    id: string;
    content: string;
    character_ids?: string[];
  }>;
}

export interface CharacterRelatedNote {
  chapterId: string;
  note: {
    id: string;
    content: string;
  };
}

export function relatedNotesForCharacter(
  chapters: CharacterRelatedNoteInput[],
  characterId: string,
): CharacterRelatedNote[] {
  return chapters.flatMap((chapter) =>
    (chapter.notes ?? [])
      .filter((note) => note.character_ids?.includes(characterId))
      .map((note) => ({
        chapterId: chapter.id,
        note: { id: note.id, content: note.content },
      })),
  );
}
