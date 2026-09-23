import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Transaction,
} from "firebase/firestore/lite";
import type { ReferenceOccurrence } from "@/libs/entities/references";
import type { EntityId } from "@/libs/entities/types";
import { db } from "./app";

export const ENTITY_REFERENCE_PAGE_SIZE = 20;

export type EntityReferenceSourceType =
  | "chapter_note"
  | "event"
  | "adaptation_note";

export type EntityReference = {
  id: string;
  entity_id: EntityId;
  source_type: EntityReferenceSourceType;
  source_id: string;
  source_key: string;
  note_id?: string;
  volume_id?: string;
  title: string;
  preview: string;
  sort_order: number;
  updated_at: string;
};

export type EntityReferenceCursor = Pick<EntityReference, "updated_at" | "id">;

export type EntityReferencePage = {
  items: EntityReference[];
  nextCursor: EntityReferenceCursor | null;
};

type SourceIdentity = {
  sourceType: EntityReferenceSourceType;
  sourceId: string;
  noteId?: string;
  entityId: EntityId;
};

type Source = Omit<SourceIdentity, "entityId">;

function entityReferencesCol(novelId: string) {
  return collection(db, "novels", novelId, "entityReferences");
}

function sourceKey({ sourceType, sourceId }: Source) {
  return [sourceType, encodeURIComponent(sourceId)].join(":");
}

export function entityReferenceId(source: SourceIdentity) {
  return [
    source.sourceType,
    encodeURIComponent(source.sourceId),
    source.noteId ? encodeURIComponent(source.noteId) : "-",
    encodeURIComponent(source.entityId),
  ].join("_");
}

function resolvedEntityIds(references: ReferenceOccurrence[] | undefined) {
  return [
    ...new Set(
      (references ?? []).flatMap((occurrence) =>
        occurrence.token.status === "resolved"
          ? [occurrence.token.reference.entityId]
          : [],
      ),
    ),
  ];
}

function noteReferences({
  sourceType,
  novelId,
  sourceId,
  volumeId,
  title,
  sortOrder,
  updatedAt,
  notes,
}: {
  sourceType: "chapter_note" | "adaptation_note";
  novelId: string;
  sourceId: string;
  volumeId: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
  notes: Array<{
    id: string;
    content: string;
    references?: ReferenceOccurrence[];
  }>;
}): EntityReference[] {
  return notes.flatMap((note) =>
    resolvedEntityIds(note.references).map((entityId) => {
      const identity = { sourceType, sourceId, noteId: note.id, entityId };
      return {
        id: entityReferenceId(identity),
        entity_id: entityId,
        source_type: sourceType,
        source_id: sourceId,
        source_key: sourceKey(identity),
        note_id: note.id,
        volume_id: volumeId,
        title,
        preview: note.content,
        sort_order: sortOrder,
        updated_at: updatedAt,
      };
    }),
  );
}

export function referencesForChapterNotes(input: Omit<Parameters<typeof noteReferences>[0], "sourceType">) {
  return noteReferences({ ...input, sourceType: "chapter_note" });
}

export function referencesForAdaptationNotes(input: Omit<Parameters<typeof noteReferences>[0], "sourceType">) {
  return noteReferences({ ...input, sourceType: "adaptation_note" });
}

export function referencesForEvent({
  novelId: _novelId,
  eventId,
  title,
  sortOrder,
  updatedAt,
  references,
}: {
  novelId: string;
  eventId: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
  references?: ReferenceOccurrence[];
}): EntityReference[] {
  return resolvedEntityIds(references).map((entityId) => {
    const identity = { sourceType: "event" as const, sourceId: eventId, entityId };
    return {
      id: entityReferenceId(identity),
      entity_id: entityId,
      source_type: "event" as const,
      source_id: eventId,
      source_key: sourceKey(identity),
      title,
      preview: title,
      sort_order: sortOrder,
      updated_at: updatedAt,
    };
  });
}

export async function replaceEntityReferences(
  transaction: Transaction,
  novelId: string,
  source: Source,
  next: EntityReference[],
) {
  const existing = await transaction.get(
    query(entityReferencesCol(novelId), where("source_key", "==", sourceKey(source))),
  );
  existing.docs.forEach((item) => transaction.delete(item.ref));
  next.forEach(({ id, ...data }) =>
    transaction.set(
      doc(entityReferencesCol(novelId), id),
      data,
    ),
  );
}

export async function deleteEntityReferences(
  transaction: Transaction,
  novelId: string,
  source: Source,
) {
  await replaceEntityReferences(transaction, novelId, source, []);
}

export async function getEntityReferencePage(
  novelId: string,
  entityId: EntityId,
  cursor: EntityReferenceCursor | null = null,
  pageSize = ENTITY_REFERENCE_PAGE_SIZE,
): Promise<EntityReferencePage> {
  const clauses = [
    where("entity_id", "==", entityId),
    orderBy("updated_at", "desc"),
    orderBy(documentId(), "desc"),
    ...(cursor ? [startAfter(cursor.updated_at, cursor.id)] : []),
    limit(pageSize + 1),
  ];
  const snapshot = await getDocs(query(entityReferencesCol(novelId), ...clauses));
  const entries = snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<EntityReference, "id">),
  }));
  const hasMore = entries.length > pageSize;
  const items = hasMore ? entries.slice(0, pageSize) : entries;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? { id: last.id, updated_at: last.updated_at } : null,
  };
}
