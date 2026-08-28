import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { Chapter, ChapterWithCharacters, Tag } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getTags } from "./tags";

interface ChapterDoc {
  number: number;
  title: string;
  summary: string;
  read_at: Timestamp | null;
  novel_id: string;
  volume_id: string;
  tag_ids: string[];
  character_ids: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function chaptersCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "chapters");
}

function chapterRef(novelId: string, volumeId: string, chapterId: string) {
  return doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId);
}

function markerRef(novelId: string, number: number) {
  return doc(db, "novels", novelId, "chapterNumbers", String(number));
}

function toChapter(id: string, data: ChapterDoc, tags: Tag[]): Chapter {
  return {
    id,
    volume_id: data.volume_id,
    number: data.number,
    title: data.title,
    summary: data.summary,
    read_at: data.read_at ? tsToIso(data.read_at) : null,
    tags,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

function resolveTags(tagIds: string[], byId: Map<string, Tag>): Tag[] {
  return tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t));
}

async function tagsForChapter(novelId: string, tagIds: string[]): Promise<Tag[]> {
  if (tagIds.length === 0) return [];
  const allTags = await getTags(novelId);
  return resolveTags(tagIds, new Map(allTags.map((t) => [t.id, t])));
}

export async function getChaptersByVolume(
  novelId: string,
  volumeId: string,
): Promise<Chapter[]> {
  const snapshot = await getDocs(
    query(chaptersCol(novelId, volumeId), orderBy("number", "asc")),
  );
  // Fetch the novel's tags exactly once (not per chapter) to avoid N+1 reads.
  const allTags = await getTags(novelId);
  const byId = new Map(allTags.map((t) => [t.id, t]));
  return snapshot.docs.map((d) => {
    const data = d.data() as ChapterDoc;
    return toChapter(d.id, data, resolveTags(data.tag_ids, byId));
  });
}

export async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<ChapterWithCharacters> {
  const snapshot = await getDoc(chapterRef(novelId, volumeId, chapterId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  const data = snapshot.data() as ChapterDoc;
  const tags = await tagsForChapter(novelId, data.tag_ids);
  const chapter = toChapter(snapshot.id, data, tags);
  // Character hydration is added in Task 5 alongside mention auto-link (both need the
  // same temporary Go-API character lookup) — empty for now, matching a chapter with no
  // linked characters yet.
  return { ...chapter, characters: [] };
}

export interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  read_at?: string | null;
}

export async function createChapter(
  novelId: string,
  volumeId: string,
  payload: ChapterCreatePayload,
): Promise<Chapter> {
  const chapterRefNew = doc(chaptersCol(novelId, volumeId));
  const marker = markerRef(novelId, payload.number);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(marker);
    if (existing.exists()) {
      throw new Error("chapter number already exists in this novel");
    }
    tx.set(marker, { chapter_id: chapterRefNew.id });
    tx.set(
      chapterRefNew,
      withCreateTimestamps({
        number: payload.number,
        title: payload.title,
        summary: payload.summary ?? "",
        read_at: payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null,
        novel_id: novelId,
        volume_id: volumeId,
        tag_ids: [],
        character_ids: [],
      }),
    );
  });

  const snapshot = await getDoc(chapterRefNew);
  return toChapter(snapshot.id, snapshot.data() as ChapterDoc, []);
}

export interface ChapterPayload {
  title?: string;
  summary?: string;
  read_at?: string | null;
}

export async function updateChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  payload: ChapterPayload,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.read_at !== undefined) {
    update.read_at = payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null;
  }
  await updateDoc(chapterRef(novelId, volumeId, chapterId), withUpdateTimestamp(update));
}

export async function deleteChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = chapterRef(novelId, volumeId, chapterId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    const { number } = snapshot.data() as ChapterDoc;
    tx.delete(ref);
    tx.delete(markerRef(novelId, number));
  });
}

export async function linkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(chapterRef(novelId, volumeId, chapterId), {
    tag_ids: arrayUnion(tagId),
  });
}

export async function unlinkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(chapterRef(novelId, volumeId, chapterId), {
    tag_ids: arrayRemove(tagId),
  });
}

export interface ChapterOrderEntry {
  id: string;
  number: number;
}

export async function reorderChapters(
  novelId: string,
  volumeId: string,
  entries: ChapterOrderEntry[],
): Promise<void> {
  const batch = writeBatch(db);
  entries.forEach((entry) => {
    batch.update(chapterRef(novelId, volumeId, entry.id), {
      number: entry.number,
      updated_at: serverTimestamp(),
    });
    batch.set(markerRef(novelId, entry.number), { chapter_id: entry.id });
  });
  await batch.commit();
}
