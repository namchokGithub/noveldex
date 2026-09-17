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
import { ResourceNotFoundError } from "@/libs/errors";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";

interface VolumeDoc {
  number: number;
  // `title` is retained for documents written before bilingual titles.
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
  source_img_url?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const MAX_DESCRIPTION_LENGTH = 500;

function optionalUrl(value: string | null | undefined, field: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  return trimmed;
}

function validateDescription(description: string | undefined) {
  if (
    description !== undefined &&
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    throw new Error(
      `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
    );
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

function adaptationsCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "adaptations");
}

type VolumeAggregate = Pick<Volume, "chapter_count" | "read_count">;

const EMPTY_VOLUME_AGGREGATE: VolumeAggregate = {
  chapter_count: 0,
  read_count: 0,
};

function aggregateChaptersByVolume(
  snapshots: Iterable<{ data: () => unknown }>,
): Map<string, VolumeAggregate> {
  const aggregates = new Map<string, VolumeAggregate>();
  for (const snapshot of snapshots) {
    const chapter = snapshot.data() as {
      volume_id: string;
      kind?: string;
      read_at?: unknown | null;
    };
    if ((chapter.kind ?? "chapter") !== "chapter") continue;
    const aggregate = aggregates.get(chapter.volume_id) ?? {
      ...EMPTY_VOLUME_AGGREGATE,
    };
    aggregate.chapter_count += 1;
    if (chapter.read_at != null) aggregate.read_count += 1;
    aggregates.set(chapter.volume_id, aggregate);
  }
  return aggregates;
}

async function volumeAggregates(novelId: string, volumeId: string) {
  const snapshot = await getDocs(chaptersCol(novelId, volumeId));
  return (
    aggregateChaptersByVolume(snapshot.docs).get(volumeId) ??
    EMPTY_VOLUME_AGGREGATE
  );
}

export type VolumeMetadata = Omit<Volume, "chapter_count" | "read_count">;

function toVolumeMetadata(
  novelId: string,
  id: string,
  data: VolumeDoc,
): VolumeMetadata {
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
    source_img_url: data.source_img_url ?? null,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

async function toVolume(
  novelId: string,
  id: string,
  data: VolumeDoc,
  aggregate: VolumeAggregate = EMPTY_VOLUME_AGGREGATE,
): Promise<Volume> {
  return {
    ...toVolumeMetadata(novelId, id, data),
    ...aggregate,
  };
}

export interface VolumeCreatePayload {
  number: number;
  /** Legacy title input; treated as the English title. */
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
  source_img_url?: string | null;
}

export interface VolumePayload {
  number?: number;
  /** Legacy title input; treated as the English title. */
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
  source_img_url?: string | null;
}

export async function getVolumes(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedVolumes> {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const perPage = ALLOWED_PER_PAGE.includes(options?.perPage as number)
    ? (options!.perPage as number)
    : 5;

  const novelChapters = collectionGroup(db, "chapters");
  const [allSnap, novelChaptersSnap] = await Promise.all([
    getDocs(query(volumesCol(novelId), orderBy("number", "asc"))),
    getDocs(query(novelChapters, where("novel_id", "==", novelId))),
  ]);
  const totalItems = allSnap.size;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const pageDocs = allSnap.docs.slice(start, start + perPage);
  const aggregates = aggregateChaptersByVolume(novelChaptersSnap.docs);
  const items = await Promise.all(
    pageDocs.map((d) =>
      toVolume(
        novelId,
        d.id,
        d.data() as VolumeDoc,
        aggregates.get(d.id) ?? EMPTY_VOLUME_AGGREGATE,
      ),
    ),
  );

  const summaryAggregate = [...aggregates.values()].reduce(
    (summary, aggregate) => ({
      chapter_count: summary.chapter_count + aggregate.chapter_count,
      read_count: summary.read_count + aggregate.read_count,
    }),
    EMPTY_VOLUME_AGGREGATE,
  );

  const summary: VolumeListSummary = {
    total_volumes: totalItems,
    total_chapters: summaryAggregate.chapter_count,
    read_count: summaryAggregate.read_count,
  };

  return {
    items,
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: totalPages,
    },
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
export async function getVolumesFlat(
  novelId: string,
): Promise<VolumeSearchSource[]> {
  const snapshot = await getDocs(
    query(volumesCol(novelId), orderBy("number", "asc")),
  );
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

export async function getVolume(
  novelId: string,
  volumeId: string,
): Promise<Volume> {
  const snapshot = await getDoc(
    doc(db, "novels", novelId, "volumes", volumeId),
  );
  if (!snapshot.exists()) {
    throw new ResourceNotFoundError("volume");
  }
  return toVolume(
    novelId,
    snapshot.id,
    snapshot.data() as VolumeDoc,
    await volumeAggregates(novelId, volumeId),
  );
}

export async function getVolumeMetadata(
  novelId: string,
  volumeId: string,
): Promise<VolumeMetadata> {
  const snapshot = await getDoc(
    doc(db, "novels", novelId, "volumes", volumeId),
  );
  if (!snapshot.exists()) {
    throw new ResourceNotFoundError("volume");
  }
  return toVolumeMetadata(novelId, snapshot.id, snapshot.data() as VolumeDoc);
}

export async function createVolume(
  novelId: string,
  payload: VolumeCreatePayload,
): Promise<Volume> {
  validateDescription(payload.description);
  const title_en = (payload.title_en ?? payload.title ?? "").trim();
  if (!title_en) throw new Error("English volume title is required");
  const title_th = payload.title_th?.trim() ?? "";
  const source_img_url = optionalUrl(payload.source_img_url, "source_img_url");
  const ref = await addDoc(
    volumesCol(novelId),
    withCreateTimestamps({
      number: payload.number,
      title: title_en,
      title_en,
      title_th,
      description: payload.description ?? "",
      source_img_url,
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
  if (payload.source_img_url !== undefined) {
    update.source_img_url = optionalUrl(payload.source_img_url, "source_img_url");
  }
  const ref = doc(
    db,
    "novels",
    novelId,
    "volumes",
    volumeId,
  ) as DocumentReference<VolumeDoc, VolumeDoc>;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  return toVolume(
    novelId,
    snapshot.id,
    snapshot.data() as VolumeDoc,
    await volumeAggregates(novelId, volumeId),
  );
}

export async function deleteVolume(
  novelId: string,
  volumeId: string,
): Promise<void> {
  const [chapterDocs, adaptationDocs] = await Promise.all([
    getDocs(chaptersCol(novelId, volumeId)),
    getDocs(adaptationsCol(novelId, volumeId)),
  ]);

  for (let i = 0; i < chapterDocs.docs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = chapterDocs.docs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((chapterDoc) => {
      const number = (chapterDoc.data() as { number: number | null }).number;
      batch.delete(chapterDoc.ref);
      if (number !== null)
        batch.delete(
          doc(db, "novels", novelId, "chapterNumbers", String(number)),
        );
    });
    await batch.commit();
  }

  for (let i = 0; i < adaptationDocs.docs.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    adaptationDocs.docs
      .slice(i, i + BATCH_CHUNK_SIZE)
      .forEach((adaptationDoc) => {
        batch.delete(adaptationDoc.ref);
      });
    await batch.commit();
  }

  await deleteDoc(doc(db, "novels", novelId, "volumes", volumeId));
}
