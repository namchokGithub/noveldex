import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { NovelEvent } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getAllCharacters } from "./characters";

interface EventDoc {
  title: string;
  description: string;
  story_date: string;
  sort_order: number;
  chapter_id: string | null;
  chapter_volume_id: string | null;
  chapter_title: string | null;
  chapter_number: number | null;
  character_ids: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function eventsCol(novelId: string) {
  return collection(db, "novels", novelId, "events");
}

function eventRef(novelId: string, eventId: string) {
  return doc(db, "novels", novelId, "events", eventId);
}

function toEvent(
  novelId: string,
  id: string,
  data: EventDoc,
  characterNameById: Map<string, string>,
): NovelEvent {
  const characterIds = data.character_ids ?? [];
  const characterNames = characterIds
    .map((cid) => characterNameById.get(cid))
    .filter((name): name is string => Boolean(name));

  return {
    id,
    novel_id: novelId,
    chapter_id: data.chapter_id ?? null,
    chapter_volume_id: data.chapter_volume_id ?? null,
    chapter_title: data.chapter_title ?? null,
    chapter_number: data.chapter_number ?? null,
    title: data.title,
    description: data.description,
    story_date: data.story_date,
    sort_order: data.sort_order,
    character_names: characterNames,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

// Resolves character_ids -> character_names for a single event (create/update paths).
// Mirrors chapters.ts's tagsForChapter: skip the getAllCharacters round trip entirely
// when there are no ids to resolve, since character_ids is empty on every event today.
async function characterNameLookup(
  novelId: string,
  characterIds: string[],
): Promise<Map<string, string>> {
  if (characterIds.length === 0) return new Map();
  const all = await getAllCharacters(novelId);
  return new Map(all.map((c) => [c.id, c.name]));
}

async function resolveChapterFields(
  novelId: string,
  chapterId: string | null | undefined,
  volumeId: string | null | undefined,
): Promise<{
  chapter_id: string | null;
  chapter_volume_id: string | null;
  chapter_title: string | null;
  chapter_number: number | null;
}> {
  if (!chapterId) {
    return {
      chapter_id: null,
      chapter_volume_id: null,
      chapter_title: null,
      chapter_number: null,
    };
  }
  if (!volumeId) {
    throw new Error("chapter_volume_id is required when chapter_id is set");
  }
  const snapshot = await getDoc(
    doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId),
  );
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  const chapterData = snapshot.data() as { title: string; number: number };
  return {
    chapter_id: chapterId,
    chapter_volume_id: volumeId,
    chapter_title: chapterData.title,
    chapter_number: chapterData.number,
  };
}

export interface EventPayload {
  title?: string;
  description?: string;
  story_date?: string;
  sort_order?: number;
  chapter_id?: string | null;
  chapter_volume_id?: string | null;
}

export async function createEvent(novelId: string, payload: EventPayload): Promise<NovelEvent> {
  const chapterFields = await resolveChapterFields(
    novelId,
    payload.chapter_id,
    payload.chapter_volume_id,
  );
  const ref = await addDoc(
    eventsCol(novelId),
    withCreateTimestamps({
      title: payload.title ?? "",
      description: payload.description ?? "",
      story_date: payload.story_date ?? "",
      sort_order: payload.sort_order ?? 0,
      character_ids: [],
      ...chapterFields,
    }),
  );
  const snapshot = await getDoc(ref);
  const data = snapshot.data() as EventDoc;
  const nameById = await characterNameLookup(novelId, data.character_ids ?? []);
  return toEvent(novelId, snapshot.id, data, nameById);
}

export async function updateEvent(
  novelId: string,
  eventId: string,
  payload: EventPayload,
): Promise<NovelEvent> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.story_date !== undefined) update.story_date = payload.story_date;
  if (payload.sort_order !== undefined) update.sort_order = payload.sort_order;
  if (payload.chapter_id !== undefined) {
    Object.assign(
      update,
      await resolveChapterFields(novelId, payload.chapter_id, payload.chapter_volume_id),
    );
  }

  const ref = eventRef(novelId, eventId) as DocumentReference<EventDoc, EventDoc>;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  const data = snapshot.data() as EventDoc;
  const nameById = await characterNameLookup(novelId, data.character_ids ?? []);
  return toEvent(novelId, snapshot.id, data, nameById);
}

export async function getEvents(novelId: string): Promise<NovelEvent[]> {
  const snapshot = await getDocs(query(eventsCol(novelId), orderBy("sort_order", "asc")));
  // Fetch the novel's characters exactly once (not per event) to avoid N+1 reads —
  // mirrors chapters.ts's getChaptersByVolume hoisting getTags(novelId) before its map.
  const allCharacters = await getAllCharacters(novelId);
  const nameById = new Map(allCharacters.map((c) => [c.id, c.name]));
  return snapshot.docs.map((d) => toEvent(novelId, d.id, d.data() as EventDoc, nameById));
}

export async function deleteEvent(novelId: string, eventId: string): Promise<void> {
  await deleteDoc(eventRef(novelId, eventId));
}
