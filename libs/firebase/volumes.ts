import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore/lite";
import type { ChapterKind, Novel, Volume } from "@/app/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { normalizeCursorPage } from "@/libs/pagination";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import {
  applyChapterCounterDelta,
  chapterCounterContribution,
  type ChapterCounter,
} from "./counters";
import { getNovel } from "./novels";

interface VolumeDoc {
  number: number;
  // `title` is retained for documents written before bilingual titles.
  title?: string;
  title_en?: string;
  title_th?: string;
  description?: string;
  source_img_url?: string | null;
  chapter_count?: number;
  read_count?: number;
  deleting?: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const MAX_DESCRIPTION_LENGTH = 1000;

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

const BATCH_CHUNK_SIZE = 200; // chapter+marker = 2 ops/chapter, stays well under the 500-op cap
const MAX_VOLUME_PAGE_SIZE = 50;

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

function storedVolumeCounters(data: VolumeDoc): VolumeAggregate {
  return {
    chapter_count: data.chapter_count ?? 0,
    read_count: data.read_count ?? 0,
  };
}

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
  aggregate: VolumeAggregate = storedVolumeCounters(data),
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

export type VolumeCursor = { number: number; id: string };

export interface VolumePage {
  novel: Novel;
  items: Volume[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  previousCursor: VolumeCursor | null;
  nextCursor: VolumeCursor | null;
}

export function previousVolumeCursor(
  page: number,
  cursor: VolumeCursor | null,
): VolumeCursor | null {
  return page > 1 ? cursor : null;
}

export function encodeVolumeCursor(cursor: VolumeCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeVolumeCursor(value: string): VolumeCursor | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as VolumeCursor).number !== "number" ||
      !Number.isFinite((parsed as VolumeCursor).number) ||
      typeof (parsed as VolumeCursor).id !== "string" ||
      !(parsed as VolumeCursor).id ||
      (parsed as VolumeCursor).id.includes("/")
    ) {
      return null;
    }
    return parsed as VolumeCursor;
  } catch {
    return null;
  }
}

export function resolveVolumeCursorSearch({
  after,
  before,
}: {
  after?: string;
  before?: string;
}): { after: VolumeCursor | null; before: VolumeCursor | null } {
  const decodedAfter = decodeVolumeCursor(after ?? "");
  const decodedBefore = decodeVolumeCursor(before ?? "");
  const hasInvalidCursor =
    (after !== undefined && !decodedAfter) ||
    (before !== undefined && !decodedBefore);

  return hasInvalidCursor
    ? { after: null, before: null }
    : { after: decodedAfter, before: decodedBefore };
}

export async function getVolumesPage(
  novelId: string,
  options?: {
    page?: number;
    perPage?: number;
    after?: VolumeCursor | null;
    before?: VolumeCursor | null;
  },
): Promise<VolumePage> {
  const after = options?.after ?? null;
  const before = options?.before ?? null;
  const page = normalizeCursorPage(
    options?.page ?? 1,
    Boolean(after || before),
  );
  const perPage =
    Number.isInteger(options?.perPage) &&
    (options?.perPage ?? 0) > 0 &&
    (options?.perPage ?? 0) <= MAX_VOLUME_PAGE_SIZE
      ? (options?.perPage as number)
      : 5;
  const volumesQuery = before
    ? query(
        volumesCol(novelId),
        orderBy("number", "desc"),
        orderBy(documentId(), "desc"),
        startAfter(before.number, before.id),
        limit(perPage),
      )
    : after
      ? query(
          volumesCol(novelId),
          orderBy("number", "asc"),
          orderBy(documentId(), "asc"),
          startAfter(after.number, after.id),
          limit(perPage),
        )
      : query(
          volumesCol(novelId),
          orderBy("number", "asc"),
          orderBy(documentId(), "asc"),
          limit(perPage),
        );

  const [novel, snapshot] = await Promise.all([
    getNovel(novelId),
    getDocs(volumesQuery),
  ]);
  const pageDocs = before ? [...snapshot.docs].reverse() : snapshot.docs;
  const items = await Promise.all(
    pageDocs.map((volume) =>
      toVolume(novelId, volume.id, volume.data() as VolumeDoc),
    ),
  );
  const totalItems = novel.volume_count;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const first = pageDocs[0];
  const last = pageDocs.at(-1);

  return {
    novel,
    items,
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: totalPages,
    },
    previousCursor: previousVolumeCursor(
      page,
      first
        ? { number: (first.data() as VolumeDoc).number, id: first.id }
        : null,
    ),
    nextCursor:
      page < totalPages && last
        ? { number: (last.data() as VolumeDoc).number, id: last.id }
        : null,
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

// Search does not need the stored chapter/read counters returned by getVolumesPage().
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

export async function getAdjacentVolumeMetadata(
  novelId: string,
  volumeNumber: number,
): Promise<{
  previous: VolumeMetadata | null;
  next: VolumeMetadata | null;
}> {
  const [previousSnapshot, nextSnapshot] = await Promise.all([
    getDocs(
      query(
        volumesCol(novelId),
        where("number", "<", volumeNumber),
        orderBy("number", "desc"),
        limit(1),
      ),
    ),
    getDocs(
      query(
        volumesCol(novelId),
        where("number", ">", volumeNumber),
        orderBy("number", "asc"),
        limit(1),
      ),
    ),
  ]);

  const previous = previousSnapshot.docs[0];
  const next = nextSnapshot.docs[0];
  return {
    previous: previous
      ? toVolumeMetadata(novelId, previous.id, previous.data() as VolumeDoc)
      : null,
    next: next
      ? toVolumeMetadata(novelId, next.id, next.data() as VolumeDoc)
      : null,
  };
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
  const ref = doc(volumesCol(novelId));
  const batch = writeBatch(db);
  batch.set(
    ref,
    withCreateTimestamps({
      number: payload.number,
      title: title_en,
      title_en,
      title_th,
      description: payload.description ?? "",
      source_img_url,
      chapter_count: 0,
      read_count: 0,
    }),
  );
  batch.update(doc(db, "novels", novelId), { volume_count: increment(1) });
  await batch.commit();
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
    update.source_img_url = optionalUrl(
      payload.source_img_url,
      "source_img_url",
    );
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
  const volumeRef = doc(db, "novels", novelId, "volumes", volumeId);
  const deletionStarted = await runTransaction(db, async (tx) => {
    const volumeSnapshot = await tx.get(volumeRef);
    if (!volumeSnapshot.exists()) return false;
    if ((volumeSnapshot.data() as VolumeDoc).deleting !== true) {
      tx.update(volumeRef, { deleting: true });
    }
    return true;
  });
  if (!deletionStarted) return;

  while (true) {
    const chapterDocs = await getDocs(
      query(chaptersCol(novelId, volumeId), limit(BATCH_CHUNK_SIZE)),
    );
    if (chapterDocs.empty) break;

    const chunk = chapterDocs.docs;
    await runTransaction(db, async (tx) => {
      const [volumeSnapshot, chapterSnapshots] = await Promise.all([
        tx.get(volumeRef),
        Promise.all(chunk.map((chapterDoc) => tx.get(chapterDoc.ref))),
      ]);
      if (!volumeSnapshot.exists()) return;

      const chunkCounters = chapterSnapshots.reduce<ChapterCounter>(
        (total, chapterSnapshot) => {
          if (!chapterSnapshot.exists()) return total;
          const contribution = chapterCounterContribution(
            chapterSnapshot.data() as {
              kind?: ChapterKind;
              read_at?: Timestamp | null;
            },
          );
          return {
            chapter_count: total.chapter_count + contribution.chapter_count,
            read_count: total.read_count + contribution.read_count,
          };
        },
        { chapter_count: 0, read_count: 0 },
      );

      chapterSnapshots.forEach((chapterSnapshot) => {
        if (!chapterSnapshot.exists()) return;
        const number = (chapterSnapshot.data() as { number: number | null })
          .number;
        tx.delete(chapterSnapshot.ref);
        if (number !== null)
          tx.delete(
            doc(
              db,
              "novels",
              novelId,
              "volumes",
              volumeId,
              "chapterNumbers",
              String(number),
            ),
          );
      });
      applyChapterCounterDelta(tx, novelId, volumeId, {
        chapter_count: -chunkCounters.chapter_count,
        read_count: -chunkCounters.read_count,
      });
    });
  }

  const adaptationDocs = await getDocs(adaptationsCol(novelId, volumeId));
  for (let i = 0; i < adaptationDocs.docs.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    adaptationDocs.docs
      .slice(i, i + BATCH_CHUNK_SIZE)
      .forEach((adaptationDoc) => {
        batch.delete(adaptationDoc.ref);
      });
    await batch.commit();
  }

  // The guarded Chapter drain above is authoritative. Stored counters are
  // derived data and may be absent or stale on legacy Volumes.
  await runTransaction(db, async (tx) => {
    const volumeSnapshot = await tx.get(volumeRef);
    if (!volumeSnapshot.exists()) return;
    tx.delete(volumeRef);
    tx.update(doc(db, "novels", novelId), {
      volume_count: increment(-1),
    });
  });
}
