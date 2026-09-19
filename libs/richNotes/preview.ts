import type { Entity, GenericEntityType } from "@/libs/entities/types";

export function resolveGenericReference(
  entities: Entity[],
  type: GenericEntityType,
  label: string,
) {
  const normalized = label.trim().toLocaleLowerCase();
  const matches = entities.filter(
    (entity) =>
      entity.type === type &&
      [entity.name, ...entity.aliases].some(
        (value) => value.toLocaleLowerCase() === normalized,
      ),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function genericEntityHref(novelId: string, entity: Entity) {
  return `/novels/${novelId}/entities/${encodeURIComponent(entity.id)}`;
}
