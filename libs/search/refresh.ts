import type { EntityId } from "@/libs/entities/types";
import type { EntityMap } from "./normalize";
import type { SearchDocument } from "./types";

export function refreshReferenceProjection(document: SearchDocument, entityMap: EntityMap): SearchDocument {
  const entities = document.referenceIds.map((id) => entityMap.get(id)).filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
  return { ...document, referenceNames: [...new Set(entities.map((entity) => entity.name))], referenceTypes: [...new Set(entities.map((entity) => entity.type))], aliases: document.type === "entity" ? document.aliases : [...new Set(entities.flatMap((entity) => entity.aliases))] };
}

export function dependentRefreshes(entityId: EntityId, dependents: Map<EntityId, Set<string>>, documents: Map<string, SearchDocument>, entityMap: EntityMap): SearchDocument[] {
  return [...(dependents.get(entityId) ?? [])].flatMap((id) => {
    const document = documents.get(id);
    return document ? [refreshReferenceProjection(document, entityMap)] : [];
  });
}

export function refreshTagProjection(document: SearchDocument, tagNamesById: Map<string, string>): SearchDocument {
  return { ...document, tags: document.tagIds.flatMap((id) => tagNamesById.get(id) ?? []) };
}
