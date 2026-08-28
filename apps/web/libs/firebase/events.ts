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

async function toEvent(novelId: string, id: string, data: EventDoc): Promise<NovelEvent> {
  const characterNames: string[] = [];
  if (data.character_ids.length > 0) {
    const all = await getAllCharacters(novelId);
    const byId = new Map(all.map((c) => [c.id, c.name]));
    data.character_ids.forEach((cid) => {
      const name = byId.get(cid);
      if (name) characterNames.push(name);
    });
  }

  return {
    id,
    novel_id: novelId,
    chapter_id: data.chapter_id,
    chapter_volume_id: data.chapter_volume_id,
    chapter_title: data.chapter_title,
    chapter_number: data.chapter_number,
    title: data.title,
    description: data.description,
    story_date: data.story_date,
    sort_order: data.sort_order,
    character_names: characterNames,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
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
  return toEvent(novelId, snapshot.id, snapshot.data() as EventDoc);
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
  return toEvent(novelId, snapshot.id, snapshot.data() as EventDoc);
}

export async function getEvents(novelId: string): Promise<NovelEvent[]> {
  const snapshot = await getDocs(query(eventsCol(novelId), orderBy("sort_order", "asc")));
  return Promise.all(
    snapshot.docs.map((d) => toEvent(novelId, d.id, d.data() as EventDoc)),
  );
}

export async function deleteEvent(novelId: string, eventId: string): Promise<void> {
  await deleteDoc(eventRef(novelId, eventId));
}
