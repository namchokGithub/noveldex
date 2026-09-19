import type { Entity, EntityType } from "@/libs/entities/types";

export const ENTITY_REFERENCE_TYPES: readonly EntityType[] = [
  "character",
  "location",
  "skill",
  "organization",
  "item",
  "concept",
];

export type EntityReferenceFilter = EntityType | "all";

export function filterEntityReferences(
  entities: Entity[],
  type: EntityReferenceFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return entities.filter(
    (entity) =>
      (type === "all" || entity.type === type) &&
      (!normalizedQuery ||
        [entity.name, ...entity.aliases].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        )),
  );
}

export function paginateEntityReferences<T>(
  entities: T[],
  page: number,
  pageSize = 10,
) {
  const totalPages = Math.max(1, Math.ceil(entities.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  return {
    currentPage,
    totalPages,
    items: entities.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}
