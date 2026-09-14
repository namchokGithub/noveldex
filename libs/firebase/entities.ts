import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc } from "firebase/firestore/lite";
import { buildEntityId, parseEntityId } from "@/libs/entities/keys";
import { GENERIC_ENTITY_TYPES, type Entity, type GenericEntityType } from "@/libs/entities/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { db } from "./app";
import { withCreateTimestamps, withUpdateTimestamp } from "./helpers";

interface EntityDoc {
  type: GenericEntityType;
  name: string;
  aliases?: string[];
  description?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const entitiesCol = (novelId: string) => collection(db, "novels", novelId, "entities");

function sourceId(novelId: string, entityId: string): string {
  const parsed = parseEntityId(entityId);
  if (!parsed || parsed.novelId !== novelId || !GENERIC_ENTITY_TYPES.includes(parsed.type as GenericEntityType)) {
    throw new Error("Invalid entity id.");
  }
  return parsed.sourceRecordId;
}

function toEntity(novelId: string, id: string, data: EntityDoc): Entity {
  return { id: buildEntityId(novelId, data.type, id), novelId, type: data.type, name: data.name, aliases: data.aliases ?? [], description: data.description ?? "" };
}

export interface EntityCreatePayload { type: GenericEntityType; name: string; aliases: string[]; description: string }
export interface EntityUpdatePayload { name?: string; aliases?: string[]; description?: string }

export async function createEntity(novelId: string, payload: EntityCreatePayload): Promise<Entity> {
  const ref = await addDoc(entitiesCol(novelId), withCreateTimestamps({ ...payload, aliases: payload.aliases ?? [], description: payload.description ?? "" }));
  const snapshot = await getDoc(ref);
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function getEntities(novelId: string, type?: GenericEntityType): Promise<Entity[]> {
  const snapshot = await getDocs(query(entitiesCol(novelId), orderBy("name")));
  return snapshot.docs
    .map((snapshot) => toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc))
    .filter((entity) => type === undefined || entity.type === type);
}

export async function getEntity(novelId: string, entityId: string): Promise<Entity> {
  const snapshot = await getDoc(doc(entitiesCol(novelId), sourceId(novelId, entityId)));
  if (!snapshot.exists()) throw new ResourceNotFoundError("entity");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function updateEntity(novelId: string, entityId: string, payload: EntityUpdatePayload): Promise<Entity> {
  const ref = doc(entitiesCol(novelId), sourceId(novelId, entityId));
  await updateDoc(ref, withUpdateTimestamp({ ...payload } as Record<string, unknown>));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function deleteEntity(novelId: string, entityId: string): Promise<void> {
  await deleteDoc(doc(entitiesCol(novelId), sourceId(novelId, entityId)));
}
