import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore/lite";
import { buildEntityId, parseEntityId } from "@/libs/entities/keys";
import {
  GENERIC_ENTITY_TYPES,
  type Entity,
  type EntityNote,
  type GenericEntityType,
} from "@/libs/entities/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { db } from "./app";
import { withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import type { GalleryImage } from "@/app/types";

interface EntityDoc {
  type: GenericEntityType;
  name: string;
  aliases?: string[];
  description?: string;
  notes?: EntityNote[];
  gallery?: GalleryImage[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

const entitiesCol = (novelId: string) =>
  collection(db, "novels", novelId, "entities");

function sourceId(novelId: string, entityId: string): string {
  const parsed = parseEntityId(entityId);
  if (
    !parsed ||
    parsed.novelId !== novelId ||
    !GENERIC_ENTITY_TYPES.includes(parsed.type as GenericEntityType)
  ) {
    throw new Error("Invalid entity id.");
  }
  return parsed.sourceRecordId;
}

function toEntity(novelId: string, id: string, data: EntityDoc): Entity {
  return {
    id: buildEntityId(novelId, data.type, id),
    novelId,
    type: data.type,
    name: data.name,
    aliases: data.aliases ?? [],
    description: data.description ?? "",
    notes: data.notes ?? [],
    gallery: data.gallery
      ? [...data.gallery].sort((left, right) => left.sort_order - right.sort_order)
      : [],
  };
}

export interface EntityCreatePayload {
  type: GenericEntityType;
  name: string;
  aliases: string[];
  description: string;
}
export interface EntityUpdatePayload {
  name?: string;
  aliases?: string[];
  description?: string;
  notes?: EntityNote[];
  gallery?: GalleryImage[];
}

function validateGallery(gallery: GalleryImage[] | undefined) {
  if (!gallery) return;
  const ids = new Set<string>();
  for (const image of gallery) {
    if (!image.id || ids.has(image.id) || !image.image_url.trim()) {
      throw new Error("Gallery images require unique IDs and image URLs.");
    }
    ids.add(image.id);
    for (const value of [image.image_url, image.source_url]) {
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        throw new Error("Gallery image URLs must use HTTP(S).");
      }
    }
  }
}
export type EntityCursor = { name: string; id: string };
export type EntityPage = {
  entities: Entity[];
  nextCursor: EntityCursor | null;
};

export function encodeEntityCursor(cursor: EntityCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeEntityCursor(value: string): EntityCursor | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as EntityCursor).name !== "string" ||
      typeof (parsed as EntityCursor).id !== "string"
    )
      return null;
    return parsed as EntityCursor;
  } catch {
    return null;
  }
}

export async function createEntity(
  novelId: string,
  payload: EntityCreatePayload,
): Promise<Entity> {
  const ref = await addDoc(
    entitiesCol(novelId),
    withCreateTimestamps({
      ...payload,
      aliases: payload.aliases ?? [],
      description: payload.description ?? "",
    }),
  );
  const snapshot = await getDoc(ref);
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function getEntities(
  novelId: string,
  type?: GenericEntityType,
): Promise<Entity[]> {
  const snapshot = await getDocs(query(entitiesCol(novelId), orderBy("name")));
  return snapshot.docs
    .map((snapshot) =>
      toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc),
    )
    .filter((entity) => type === undefined || entity.type === type);
}

export async function getEntitiesPage(
  novelId: string,
  type: GenericEntityType,
  cursor: EntityCursor | null,
  pageSize = 20,
): Promise<EntityPage> {
  const pageLimit = limit(pageSize + 1);
  const entityQuery = cursor
    ? query(
        entitiesCol(novelId),
        where("type", "==", type),
        orderBy("name"),
        orderBy(documentId()),
        startAfter(cursor.name, cursor.id),
        pageLimit,
      )
    : query(
        entitiesCol(novelId),
        where("type", "==", type),
        orderBy("name"),
        orderBy(documentId()),
        pageLimit,
      );
  const snapshot = await getDocs(entityQuery);
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const last = pageDocs.at(-1);

  return {
    entities: pageDocs.map((entity) =>
      toEntity(novelId, entity.id, entity.data() as EntityDoc),
    ),
    nextCursor:
      snapshot.docs.length > pageSize && last
        ? { name: (last.data() as EntityDoc).name, id: last.id }
        : null,
  };
}

export async function getEntitiesPageByNamePrefix(
  novelId: string,
  type: GenericEntityType,
  prefix: string,
  cursor: EntityCursor | null,
  pageSize = 20,
): Promise<EntityPage> {
  const pageLimit = limit(pageSize + 1);
  const entityQuery = cursor
    ? query(
        entitiesCol(novelId),
        where("type", "==", type),
        orderBy("name"),
        orderBy(documentId()),
        startAfter(cursor.name, cursor.id),
        endAt(`${prefix}\uf8ff`),
        pageLimit,
      )
    : query(
        entitiesCol(novelId),
        where("type", "==", type),
        orderBy("name"),
        orderBy(documentId()),
        startAt(prefix),
        endAt(`${prefix}\uf8ff`),
        pageLimit,
      );
  const snapshot = await getDocs(entityQuery);
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const last = pageDocs.at(-1);

  return {
    entities: pageDocs.map((entity) =>
      toEntity(novelId, entity.id, entity.data() as EntityDoc),
    ),
    nextCursor:
      snapshot.docs.length > pageSize && last
        ? { name: (last.data() as EntityDoc).name, id: last.id }
        : null,
  };
}

export async function getEntity(
  novelId: string,
  entityId: string,
): Promise<Entity> {
  const snapshot = await getDoc(
    doc(entitiesCol(novelId), sourceId(novelId, entityId)),
  );
  if (!snapshot.exists()) throw new ResourceNotFoundError("entity");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function updateEntity(
  novelId: string,
  entityId: string,
  payload: EntityUpdatePayload,
): Promise<Entity> {
  validateGallery(payload.gallery);
  const ref = doc(entitiesCol(novelId), sourceId(novelId, entityId));
  await updateDoc(
    ref,
    withUpdateTimestamp({ ...payload } as Record<string, unknown>),
  );
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toEntity(novelId, snapshot.id, snapshot.data() as EntityDoc);
}

export async function updateEntityGallery(
  novelId: string,
  entityId: string,
  gallery: GalleryImage[],
): Promise<void> {
  validateGallery(gallery);
  await updateDoc(
    doc(entitiesCol(novelId), sourceId(novelId, entityId)),
    withUpdateTimestamp({ gallery }),
  );
}

export async function deleteEntity(
  novelId: string,
  entityId: string,
): Promise<void> {
  await deleteDoc(doc(entitiesCol(novelId), sourceId(novelId, entityId)));
}
