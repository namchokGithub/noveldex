import type { EntityId } from "@/libs/entities/types";
import type { ReferenceOccurrence } from "@/libs/entities/references";

type ReferenceSource = {
  references?: ReferenceOccurrence[];
};

function referencesEntity(
  references: ReferenceOccurrence[] | undefined,
  entityId: EntityId,
): boolean {
  return (references ?? []).some(
    (occurrence) =>
      occurrence.token.status === "resolved" &&
      occurrence.token.reference.entityId === entityId,
  );
}

export function notesForEntity<
  TNote extends ReferenceSource,
  TChapter extends { notes: TNote[] },
>(chapters: TChapter[], entityId: EntityId): Array<{ chapter: TChapter; note: TNote }> {
  return chapters.flatMap((chapter) =>
    chapter.notes
      .filter((note) => referencesEntity(note.references, entityId))
      .map((note) => ({ chapter, note })),
  );
}

export function eventsForEntity<
  T extends { description_references?: ReferenceOccurrence[] },
>(events: T[], entityId: EntityId): T[] {
  return events.filter((event) =>
    referencesEntity(event.description_references, entityId),
  );
}

export function adaptationsForEntity<
  T extends { adapted_chapter_ids: string[]; notes: ReferenceSource[] },
>(adaptations: T[], entityId: EntityId, chapterIds: ReadonlySet<string>): T[] {
  return adaptations.filter(
    (adaptation) =>
      adaptation.adapted_chapter_ids.some((chapterId) => chapterIds.has(chapterId)) ||
      adaptation.notes.some((note) => referencesEntity(note.references, entityId)),
  );
}
