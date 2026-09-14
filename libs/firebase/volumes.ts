import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore/lite";
import type { PaginatedVolumes, Volume, VolumeListSummary } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";

interface VolumeDoc {
  number: number;
  // `title` is retained for documents written before bilingual titles.
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const MAX_DESCRIPTION_LENGTH = 500;

function validateDescription(description: string | undefined) {
  if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }
}

const ALLOWED_PER_PAGE = [5, 10, 20, 50];
const BATCH_CHUNK_SIZE = 200; // chapter+marker = 2 ops/chapter, stays well under the 500-op cap

function volumesCol(novelId: string) {
  return collection(db, "novels", novelId, "volumes");
}

function chaptersCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "chapters");
}

async function volumeAggregates(novelId: string, volumeId: string) {
  const col = chaptersCol(novelId, volumeId);
  const [totalSnap, readSnap] = await Promise.all([
    getDocs(col),
    getDocs(query(col, where("read_at", "!=", null))),
  ]);
  return {
    chapter_count: totalSnap.size,
    read_count: readSnap.size,
  };
}

async function toVolume(novelId: string, id: string, data: VolumeDoc): Promise<Volume> {
  const { chapter_count, read_count } = await volumeAggregates(novelId, id);
  const title_en = data.title_en ?? data.title ?? "";
  const title_th = data.title_th ?? "";
  return {
    id,
    novel_id: novelId,
    number: data.number,
    title: title_en,
    title_en,
    title_th,
    description: data.description ?? "",
    chapter_count,
    read_count,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

export interface VolumeCreatePayload {
  number: number;
  /** Legacy title input; treated as the English title. */
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
}

export interface VolumePayload {
  number?: number;
  /** Legacy title input; treated as the English title. */
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
}

export async function getVolumes(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedVolumes> {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const perPage = ALLOWED_PER_PAGE.includes(options?.perPage as number)
    ? (options!.perPage as number)
    : 5;

  const allSnap = await getDocs(query(volumesCol(novelId), orderBy("number", "asc")));
  const totalItems = allSnap.size;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const pageDocs = allSnap.docs.slice(start, start + perPage);
  const items = await Promise.all(
    pageDocs.map((d) => toVolume(novelId, d.id, d.data() as VolumeDoc)),
  );

  const novelChapters = collectionGroup(db, "chapters");
  const [totalVolumesSnap, novelChaptersSnap, novelReadSnap] = await Promise.all([
    getDocs(volumesCol(novelId)),
    getDocs(query(novelChapters, where("novel_id", "==", novelId))),
    getDocs(
      query(novelChapters, where("novel_id", "==", novelId), where("read_at", "!=", null)),
    ),
  ]);

  const summary: VolumeListSummary = {
    total_volumes: totalVolumesSnap.size,
    total_chapters: novelChaptersSnap.size,
    read_count: novelReadSnap.size,
  };

  return {
    items,
    pagination: { page, per_page: perPage, total_items: totalItems, total_pages: totalPages },
    summary,
  };
}

export interface VolumeSearchSource {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  title_en: string;
  title_th: string;
  description: string;
}

// Search does not need the chapter/read aggregates calculated by getVolumes().
export async function getVolumesFlat(novelId: string): Promise<VolumeSearchSource[]> {
  const snapshot = await getDocs(query(volumesCol(novelId), orderBy("number", "asc")));
  return snapshot.docs.map((snapshot) => {
    const data = snapshot.data() as VolumeDoc;
    return {
      id: snapshot.id,
      novel_id: novelId,
      number: data.number,
      title: data.title_en || data.title || "",
      title_en: data.title_en ?? data.title ?? "",
      title_th: data.title_th ?? "",
      description: data.description ?? "",
    };
  });
}

export async function getVolume(novelId: string, volumeId: string): Promise<Volume> {
  const snapshot = await getDoc(doc(db, "novels", novelId, "volumes", volumeId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function createVolume(novelId: string, payload: VolumeCreatePayload): Promise<Volume> {
  validateDescription(payload.description);
  const title_en = (payload.title_en ?? payload.title ?? "").trim();
  if (!title_en) throw new Error("English volume title is required");
  const title_th = payload.title_th?.trim() ?? "";
  const ref = await addDoc(
    volumesCol(novelId),
    withCreateTimestamps({
      number: payload.number,
      title: title_en,
      title_en,
      title_th,
      description: payload.description ?? "",
    }),
  );
  const snapshot = await getDoc(ref);
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function updateVolume(
  novelId: string,
  volumeId: string,
  payload: VolumePayload,
): Promise<Volume> {
  validateDescription(payload.description);
  const update: VolumePayload = { ...payload };
  if (payload.title !== undefined) {
    update.title = payload.title;
    update.title_en = payload.title;
  }
  if (payload.title_en !== undefined) {
    const title_en = payload.title_en.trim();
    if (!title_en) throw new Error("English volume title is required");
    update.title = title_en;
    update.title_en = title_en;
  }
  if (payload.title_th !== undefined) update.title_th = payload.title_th.trim();
  const ref = doc(db, "novels", novelId, "volumes", volumeId) as DocumentReference<
    VolumeDoc,
    VolumeDoc
  >;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  return toVolume(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function deleteVolume(novelId: string, volumeId: string): Promise<void> {
  const chapterDocs = await getDocs(chaptersCol(novelId, volumeId));

  for (let i = 0; i < chapterDocs.docs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = chapterDocs.docs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((chapterDoc) => {
      const number = (chapterDoc.data() as { number: number | null }).number;
      batch.delete(chapterDoc.ref);
      if (number !== null) batch.delete(doc(db, "novels", novelId, "chapterNumbers", String(number)));
    });
    await batch.commit();
  }

  await deleteDoc(doc(db, "novels", novelId, "volumes", volumeId));
}
