import { ENTITY_TYPES, type EntityId, type EntityType } from "./types";

export function buildEntityId(novelId: string, type: EntityType, sourceRecordId: string): EntityId {
  return `${novelId}:${type}:${sourceRecordId}`;
}

export function parseEntityId(id: EntityId) {
  const [novelId, type, ...sourceParts] = id.split(":");
  const sourceRecordId = sourceParts.join(":");
  if (!novelId || !sourceRecordId || !ENTITY_TYPES.includes(type as EntityType)) return null;
  return { novelId, type: type as EntityType, sourceRecordId };
}
