import { parseEntityId } from "@/libs/entities/keys";
import type { ReferenceOccurrence } from "@/libs/entities/references";

type ReferenceSource = {
  character_ids?: string[];
  references?: ReferenceOccurrence[];
};

function referencesCharacter(
  references: ReferenceOccurrence[] | undefined,
  characterId: string,
): boolean {
  return (references ?? []).some((occurrence) => {
    if (
      occurrence.token.status !== "resolved" ||
      occurrence.token.reference.entityType !== "character"
    )
      return false;
    return (
      parseEntityId(occurrence.token.reference.entityId)?.sourceRecordId ===
      characterId
    );
  });
}

function sourceReferencesCharacter(
  source: ReferenceSource,
  characterId: string,
): boolean {
  return (
    source.character_ids?.includes(characterId) ||
    referencesCharacter(source.references, characterId)
  );
}

export function eventsForCharacter<
  T extends {
    character_ids: string[];
    description_references?: ReferenceOccurrence[];
  },
>(events: T[], characterId: string): T[] {
  return events.filter((event) =>
    sourceReferencesCharacter(
      {
        character_ids: event.character_ids,
        references: event.description_references,
      },
      characterId,
    ),
  );
}

export function adaptationsForCharacter<
  T extends {
    adapted_chapter_ids: string[];
    notes: ReferenceSource[];
  },
>(adaptations: T[], characterId: string, chapterIds: ReadonlySet<string>): T[] {
  return adaptations.filter(
    (adaptation) =>
      adaptation.adapted_chapter_ids.some((chapterId) =>
        chapterIds.has(chapterId),
      ) ||
      adaptation.notes.some((note) =>
        sourceReferencesCharacter(note, characterId),
      ),
  );
}
