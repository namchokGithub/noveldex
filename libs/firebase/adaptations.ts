import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore/lite";
import {
  ADAPTATION_ENTRY_TYPES,
  ADAPTATION_MEDIA,
  type Adaptation,
  type AdaptationEntryType,
  type AdaptationMedium,
  type AdaptationOrderEntry,
  type ChapterNote,
} from "@/app/types";
import { compareAdaptations } from "@/libs/adaptations/order";
import { ResourceNotFoundError } from "@/libs/errors";
import { firestoreEntityLookup } from "@/libs/entities/firestoreLookup";
import { parseEntityId } from "@/libs/entities/keys";
import { reconcileReferenceOccurrences } from "@/libs/entities/reconcile";
import type { ReferenceOccurrence } from "@/libs/entities/references";
import { db } from "./app";
import { applyNonNegativeCounterDeltas } from "./counters";
import {
  deleteEntityReferences,
  referencesForAdaptationNotes,
  replaceEntityReferences,
} from "./entityReferences";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";

interface AdaptationDoc {
  novel_id: string;
  volume_id: string;
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: number;
  entry_type: AdaptationEntryType;
  entry_number: number;
  title: string;
  source_url: string | null;
  source_img_url: string | null;
  description: string;
  notes?: AdaptationNoteDoc[];
  adapted_chapter_ids?: string[];
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

function adaptationCounterDeltas(
  novelId: string,
  volumeId: string,
  delta: number,
) {
  return [
    {
      reference: doc(db, "novels", novelId, "volumes", volumeId),
      field: "adaptation_count" as const,
      delta,
    },
  ];
}

interface AdaptationNoteDoc {
  id: string;
  content: string;
  content_json?: ChapterNote["content_json"];
  character_ids?: string[];
  mentioned_character_names?: string[];
  references?: ReferenceOccurrence[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdaptationCreatePayload {
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: number;
  entry_type: AdaptationEntryType;
  entry_number: number;
  title: string;
  source_url?: string | null;
  source_img_url?: string | null;
  description?: string;
  sort_order?: number;
  adapted_chapter_ids?: string[];
}

export type AdaptationPayload = Partial<AdaptationCreatePayload> & {
  notes?: ChapterNote[];
  adapted_chapter_ids?: string[];
};

const MAX_DESCRIPTION_LENGTH = 500;
const BATCH_CHUNK_SIZE = 450;

function adaptationsCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "adaptations");
}

function adaptationRef(
  novelId: string,
  volumeId: string,
  adaptationId: string,
) {
  return doc(
    db,
    "novels",
    novelId,
    "volumes",
    volumeId,
    "adaptations",
    adaptationId,
  );
}

function toAdaptation(id: string, data: AdaptationDoc): Adaptation {
  return {
    id,
    novel_id: data.novel_id,
    volume_id: data.volume_id,
    medium: data.medium,
    group_label: data.group_label,
    group_sort_order: data.group_sort_order,
    entry_type: data.entry_type,
    entry_number: data.entry_number,
    title: data.title,
    source_url: data.source_url ?? null,
    source_img_url: data.source_img_url ?? null,
    description: data.description ?? "",
    notes: (data.notes ?? [])
      .map((note) => ({
        id: note.id,
        content: note.content,
        content_json: note.content_json,
        character_ids: note.character_ids ?? [],
        mentioned_character_names: note.mentioned_character_names ?? [],
        references: note.references ?? [],
        created_at: tsToIso(note.created_at),
        updated_at: tsToIso(note.updated_at),
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    adapted_chapter_ids: data.adapted_chapter_ids ?? [],
    sort_order: data.sort_order,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

function notesToDoc(notes: ChapterNote[]): AdaptationNoteDoc[] {
  return [...notes]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((note) => ({
      id: note.id,
      content: note.content,
      ...(note.content_json ? { content_json: note.content_json } : {}),
      character_ids: note.character_ids ?? [],
      mentioned_character_names: note.mentioned_character_names ?? [],
      references: note.references ?? [],
      created_at: Timestamp.fromDate(new Date(note.created_at)),
      updated_at: Timestamp.fromDate(new Date(note.updated_at)),
    }));
}

function characterFields(references: ReferenceOccurrence[]) {
  const character_ids = references.flatMap((occurrence) => {
    if (
      occurrence.token.status !== "resolved" ||
      occurrence.token.reference.entityType !== "character"
    )
      return [];
    const parsed = parseEntityId(occurrence.token.reference.entityId);
    return parsed ? [parsed.sourceRecordId] : [];
  });
  const mentioned_character_names = references.flatMap((occurrence) => {
    if (occurrence.token.status === "resolved")
      return occurrence.token.reference.entityType === "character"
        ? [occurrence.token.reference.label]
        : [];
    return occurrence.token.typed === null ||
      occurrence.token.typed === "character"
      ? [occurrence.token.label]
      : [];
  });
  return {
    character_ids: [...new Set(character_ids)],
    mentioned_character_names: [...new Set(mentioned_character_names)],
  };
}

async function resolveNotes(
  novelId: string,
  notes: ChapterNote[],
  previousById: Map<string, AdaptationNoteDoc>,
): Promise<ChapterNote[]> {
  const lookup = firestoreEntityLookup();
  return Promise.all(
    notes.map(async (note) => {
      const previous = previousById.get(note.id);
      const references = await reconcileReferenceOccurrences(
        novelId,
        note.content,
        previous
          ? {
              content: previous.content,
              occurrences: previous.references ?? [],
            }
          : null,
        lookup,
      );
      return { ...note, references, ...characterFields(references) };
    }),
  );
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function optionalUrl(
  value: string | null | undefined,
  field: string,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  return trimmed;
}

function validatePayload(payload: AdaptationPayload): AdaptationPayload {
  const validated: AdaptationPayload = { ...payload };
  if (
    payload.medium !== undefined &&
    !ADAPTATION_MEDIA.includes(payload.medium)
  ) {
    throw new Error("medium is invalid");
  }
  if (
    payload.entry_type !== undefined &&
    !ADAPTATION_ENTRY_TYPES.includes(payload.entry_type)
  ) {
    throw new Error("entry_type is invalid");
  }
  if (payload.group_label !== undefined)
    validated.group_label = requiredText(payload.group_label, "group_label");
  if (payload.title !== undefined)
    validated.title = requiredText(payload.title, "title");
  if (payload.group_sort_order !== undefined)
    validated.group_sort_order = positiveInteger(
      payload.group_sort_order,
      "group_sort_order",
    );
  if (payload.entry_number !== undefined)
    validated.entry_number = positiveInteger(
      payload.entry_number,
      "entry_number",
    );
  if (payload.sort_order !== undefined)
    validated.sort_order = positiveInteger(payload.sort_order, "sort_order");
  if (payload.description !== undefined) {
    if (payload.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
      );
    }
    validated.description = payload.description;
  }
  if (payload.source_url !== undefined)
    validated.source_url = optionalUrl(payload.source_url, "source_url");
  if (payload.source_img_url !== undefined)
    validated.source_img_url = optionalUrl(
      payload.source_img_url,
      "source_img_url",
    );
  return validated;
}

async function validateChapterIds(
  novelId: string,
  volumeId: string,
  chapterIds: string[],
): Promise<string[]> {
  if (!Array.isArray(chapterIds) || chapterIds.some((id) => !id)) {
    throw new Error("adapted_chapter_ids must contain chapter ids");
  }
  const ids = [...new Set(chapterIds)];
  if (!ids.length) return [];
  const available = await chapterIdsForVolume(novelId, volumeId);
  if (ids.some((id) => !available.has(id))) {
    throw new Error("adapted chapters must belong to this volume");
  }
  return ids;
}

export async function chapterIdsForVolume(
  novelId: string,
  volumeId: string,
): Promise<Set<string>> {
  const snapshot = await getDocs(
    collection(db, "novels", novelId, "volumes", volumeId, "chapters"),
  );
  return new Set(snapshot.docs.map((chapter) => chapter.id));
}

export async function getAdaptationsByVolume(
  novelId: string,
  volumeId: string,
): Promise<Adaptation[]> {
  const snapshot = await getDocs(adaptationsCol(novelId, volumeId));
  return snapshot.docs
    .map((item) => toAdaptation(item.id, item.data() as AdaptationDoc))
    .sort(compareAdaptations);
}

export async function getLatestAdaptationByVolume(
  novelId: string,
  volumeId: string,
): Promise<Adaptation | null> {
  const snapshot = await getDocs(
    query(
      adaptationsCol(novelId, volumeId),
      orderBy("updated_at", "desc"),
      limit(1),
    ),
  );
  const latest = snapshot.docs[0];
  return latest
    ? toAdaptation(latest.id, latest.data() as AdaptationDoc)
    : null;
}

export async function getAdaptationsByChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<Adaptation[]> {
  const snapshot = await getDocs(
    query(
      adaptationsCol(novelId, volumeId),
      where("adapted_chapter_ids", "array-contains", chapterId),
    ),
  );
  return snapshot.docs
    .map((item) => toAdaptation(item.id, item.data() as AdaptationDoc))
    .sort(compareAdaptations);
}

export async function getAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
): Promise<Adaptation> {
  const snapshot = await getDoc(adaptationRef(novelId, volumeId, adaptationId));
  if (!snapshot.exists()) throw new ResourceNotFoundError("adaptation");
  return toAdaptation(snapshot.id, snapshot.data() as AdaptationDoc);
}

export async function getAdaptationsForNovel(
  novelId: string,
): Promise<Adaptation[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "adaptations"), where("novel_id", "==", novelId)),
  );
  return snapshot.docs
    .map((item) => toAdaptation(item.id, item.data() as AdaptationDoc))
    .sort(compareAdaptations);
}

export async function getAdaptationsForChapterIds(
  novelId: string,
  chapterIds: string[],
): Promise<Adaptation[]> {
  const uniqueIds = [...new Set(chapterIds)];
  const snapshots = await Promise.all(
    Array.from({ length: Math.ceil(uniqueIds.length / 30) }, (_, index) =>
      getDocs(
        query(
          collectionGroup(db, "adaptations"),
          where("novel_id", "==", novelId),
          where(
            "adapted_chapter_ids",
            "array-contains-any",
            uniqueIds.slice(index * 30, index * 30 + 30),
          ),
        ),
      ),
    ),
  );
  return [
    ...new Map(
      snapshots
        .flatMap((snapshot) => snapshot.docs)
        .map((item) => [
          item.id,
          toAdaptation(item.id, item.data() as AdaptationDoc),
        ]),
    ).values(),
  ].sort(compareAdaptations);
}

export async function createAdaptation(
  novelId: string,
  volumeId: string,
  payload: AdaptationCreatePayload,
): Promise<Adaptation> {
  const validated = validatePayload(payload);
  const existing = await getAdaptationsByVolume(novelId, volumeId);
  const sort_order =
    validated.sort_order ??
    existing
      .filter(
        (item) =>
          item.medium === validated.medium &&
          item.group_label === validated.group_label &&
          item.group_sort_order === validated.group_sort_order,
      )
      .reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
  const ref = doc(adaptationsCol(novelId, volumeId));
  const adaptation = withCreateTimestamps({
    novel_id: novelId,
    volume_id: volumeId,
    medium: validated.medium,
    group_label: validated.group_label,
    group_sort_order: validated.group_sort_order,
    entry_type: validated.entry_type,
    entry_number: validated.entry_number,
    title: validated.title,
    source_url: validated.source_url ?? null,
    source_img_url: validated.source_img_url ?? null,
    description: validated.description ?? "",
    notes: [],
    adapted_chapter_ids: await validateChapterIds(
      novelId,
      volumeId,
      payload.adapted_chapter_ids ?? [],
    ),
    sort_order,
  });
  await runTransaction(db, async (transaction) => {
    await applyNonNegativeCounterDeltas(
      transaction,
      adaptationCounterDeltas(novelId, volumeId, 1),
    );
    transaction.set(ref, adaptation);
    await replaceEntityReferences(
      transaction,
      novelId,
      [],
      referencesForAdaptationNotes({
        sourceId: ref.id,
        volumeId,
        title: adaptation.title ? adaptation.title : "",
        sortOrder: adaptation.sort_order,
        updatedAt: new Date().toISOString(),
        notes: adaptation.notes,
      }),
    );
  });
  const snapshot = await getDoc(ref);
  return toAdaptation(snapshot.id, snapshot.data() as AdaptationDoc);
}

export async function updateAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
  payload: AdaptationPayload,
): Promise<Adaptation> {
  const update = validatePayload(payload) as Record<string, unknown>;
  const ref = adaptationRef(
    novelId,
    volumeId,
    adaptationId,
  ) as DocumentReference<AdaptationDoc, AdaptationDoc>;
  if (payload.notes !== undefined) {
    const previous = await getDoc(ref);
    if (!previous.exists()) throw new Error("Request failed.");
    const notes = await resolveNotes(
      novelId,
      payload.notes,
      new Map((previous.data().notes ?? []).map((note) => [note.id, note])),
    );
    update.notes = notesToDoc(notes);
  }
  if (payload.adapted_chapter_ids !== undefined) {
    update.adapted_chapter_ids = await validateChapterIds(
      novelId,
      volumeId,
      payload.adapted_chapter_ids,
    );
  }
  const changesIndexedState =
    payload.notes !== undefined ||
    payload.title !== undefined ||
    payload.sort_order !== undefined;
  await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(ref);
    if (!previous.exists()) throw new Error("Request failed.");
    const current = previous.data();
    transaction.update(ref, withUpdateTimestamp(update));
    if (changesIndexedState) {
      await replaceEntityReferences(
        transaction,
        novelId,
        referencesForAdaptationNotes({
          sourceId: adaptationId,
          volumeId,
          title: current.title,
          sortOrder: current.sort_order,
          updatedAt: tsToIso(current.updated_at),
          notes: current.notes ?? [],
        }),
        referencesForAdaptationNotes({
          sourceId: adaptationId,
          volumeId,
          title: (update.title as string | undefined) ?? current.title,
          sortOrder:
            (update.sort_order as number | undefined) ?? current.sort_order,
          updatedAt: new Date().toISOString(),
          notes:
            (update.notes as AdaptationNoteDoc[] | undefined) ??
            current.notes ??
            [],
        }),
      );
    }
  });
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toAdaptation(snapshot.id, snapshot.data() as AdaptationDoc);
}

export async function deleteAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
): Promise<void> {
  const ref = adaptationRef(novelId, volumeId, adaptationId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    const current = snapshot.data() as AdaptationDoc;
    await deleteEntityReferences(
      transaction,
      novelId,
      referencesForAdaptationNotes({
        sourceId: adaptationId,
        volumeId,
        title: current.title,
        sortOrder: current.sort_order,
        updatedAt: tsToIso(current.updated_at),
        notes: current.notes ?? [],
      }),
    );
    await applyNonNegativeCounterDeltas(
      transaction,
      adaptationCounterDeltas(novelId, volumeId, -1),
    );
    transaction.delete(ref);
  });
}

export async function reorderAdaptations(
  novelId: string,
  volumeId: string,
  entries: AdaptationOrderEntry[],
): Promise<void> {
  const existing = await getAdaptationsByVolume(novelId, volumeId);
  const ids = new Set(existing.map((item) => item.id));
  for (const entry of entries) {
    if (!ids.has(entry.id))
      throw new Error("adaptation does not belong to this volume");
    positiveInteger(entry.sort_order, "sort_order");
  }
  for (let index = 0; index < entries.length; index += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    entries.slice(index, index + BATCH_CHUNK_SIZE).forEach((entry) => {
      batch.update(
        adaptationRef(novelId, volumeId, entry.id),
        withUpdateTimestamp({ sort_order: entry.sort_order }),
      );
    });
    await batch.commit();
  }
}
