import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
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
} from "@/app/types";
import { compareAdaptations } from "@/libs/adaptations/order";
import { db } from "./app";
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
  sort_order: number;
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
}

export type AdaptationPayload = Partial<AdaptationCreatePayload>;

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
    sort_order: data.sort_order,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
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

export async function getAdaptationsByVolume(
  novelId: string,
  volumeId: string,
): Promise<Adaptation[]> {
  const snapshot = await getDocs(adaptationsCol(novelId, volumeId));
  return snapshot.docs
    .map((item) => toAdaptation(item.id, item.data() as AdaptationDoc))
    .sort(compareAdaptations);
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
  const ref = await addDoc(
    adaptationsCol(novelId, volumeId),
    withCreateTimestamps({
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
      sort_order,
    }),
  );
  const snapshot = await getDoc(ref);
  return toAdaptation(snapshot.id, snapshot.data() as AdaptationDoc);
}

export async function updateAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
  payload: AdaptationPayload,
): Promise<Adaptation> {
  const update = validatePayload(payload);
  const ref = adaptationRef(
    novelId,
    volumeId,
    adaptationId,
  ) as DocumentReference<AdaptationDoc, AdaptationDoc>;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Request failed.");
  return toAdaptation(snapshot.id, snapshot.data() as AdaptationDoc);
}

export async function deleteAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
): Promise<void> {
  await deleteDoc(adaptationRef(novelId, volumeId, adaptationId));
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
