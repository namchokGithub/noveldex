import type {
  EntityId,
  EntityType,
  GenericEntityType,
} from "@/libs/entities/types";
import type { ReferenceOccurrence } from "@/libs/entities/references";

export type LinkedStoryEntity = {
  id: EntityId;
  type: GenericEntityType;
  label: string;
};

function isGenericEntityType(
  entityType: EntityType,
): entityType is GenericEntityType {
  return entityType !== "character";
}

export function linkedEntitiesForAdaptation({
  notes,
}: {
  notes: Array<{ references?: ReferenceOccurrence[] }>;
}): LinkedStoryEntity[] {
  const entities = new Map<EntityId, LinkedStoryEntity>();
  notes.forEach((note) => {
    note.references?.forEach((occurrence) => {
      if (occurrence.token.status !== "resolved") return;
      const reference = occurrence.token.reference;
      if (!isGenericEntityType(reference.entityType)) return;
      entities.set(reference.entityId, {
        id: reference.entityId,
        type: reference.entityType,
        label: reference.label,
      });
    });
  });
  return [...entities.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}
