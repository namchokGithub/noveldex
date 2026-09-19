import { ENTITY_TYPES, type EntityId, type EntityType } from "./types";

export function buildEntityId(novelId: string, type: EntityType, sourceRecordId: string): EntityId {
  return `${novelId}:${type}:${sourceRecordId}`;
}

export function parseEntityId(id: EntityId) {
  let decodedId = id;
  try {
    decodedId = decodeURIComponent(id);
  } catch {
    // Keep the original value so malformed IDs are rejected by the validation below.
  }

  const [novelId, type, ...sourceParts] = decodedId.split(":");
  const sourceRecordId = sourceParts.join(":");
  if (!novelId || !sourceRecordId || !ENTITY_TYPES.includes(type as EntityType)) return null;
  return { novelId, type: type as EntityType, sourceRecordId };
}
