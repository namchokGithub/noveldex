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
  where,
} from "firebase/firestore/lite";
import type { NovelEvent } from "@/app/types";
import { firestoreEntityLookup } from "@/libs/entities/firestoreLookup";
import { reconcileReferenceOccurrences } from "@/libs/entities/reconcile";
import type { ReferenceOccurrence } from "@/libs/entities/references";
import { eventsForCharacter } from "@/libs/characterCrossReferences";
import { eventsForEntity } from "@/libs/entityCrossReferences";
import type { EntityId } from "@/libs/entities/types";
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
  page_number?: number | null;
  character_ids: string[];
  description_references?: ReferenceOccurrence[];
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
  characterNameById: ReadonlyMap<string, string>,
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
    page_number: data.page_number ?? null,
    title: data.title,
    description: data.description,
    story_date: data.story_date,
    sort_order: data.sort_order,
    character_ids: characterIds,
    character_names: characterNames,
    description_references: data.description_references ?? [],
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
  const chapterData = snapshot.data() as {
    title: string;
    number: number | null;
  };
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
  page_number?: number | null;
  character_ids?: string[];
}

export async function createEvent(
  novelId: string,
  payload: EventPayload,
): Promise<NovelEvent> {
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
      page_number: payload.page_number ?? null,
      character_ids: payload.character_ids ?? [],
      description_references: await reconcileReferenceOccurrences(
        novelId,
        payload.description ?? "",
        null,
        firestoreEntityLookup(),
      ),
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
  if (payload.description !== undefined) {
    update.description = payload.description;
    const previous = await getDoc(eventRef(novelId, eventId));
    if (!previous.exists()) throw new Error("Request failed.");
    const data = previous.data() as EventDoc;
    update.description_references = await reconcileReferenceOccurrences(
      novelId,
      payload.description,
      {
        content: data.description,
        occurrences: data.description_references ?? [],
      },
      firestoreEntityLookup(),
    );
  }
  if (payload.story_date !== undefined) update.story_date = payload.story_date;
  if (payload.sort_order !== undefined) update.sort_order = payload.sort_order;
  if (payload.page_number !== undefined)
    update.page_number = payload.page_number;
  if (payload.character_ids !== undefined)
    update.character_ids = payload.character_ids;
  if (payload.chapter_id !== undefined) {
    Object.assign(
      update,
      await resolveChapterFields(
        novelId,
        payload.chapter_id,
        payload.chapter_volume_id,
      ),
    );
  }

  const ref = eventRef(novelId, eventId) as DocumentReference<
    EventDoc,
    EventDoc
  >;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  const data = snapshot.data() as EventDoc;
  const nameById = await characterNameLookup(novelId, data.character_ids ?? []);
  return toEvent(novelId, snapshot.id, data, nameById);
}

export async function getEvents(
  novelId: string,
  characterNameById?:
    | ReadonlyMap<string, string>
    | Promise<ReadonlyMap<string, string>>,
): Promise<NovelEvent[]> {
  const [snapshot, nameById] = await Promise.all([
    getDocs(query(eventsCol(novelId), orderBy("sort_order", "asc"))),
    // Callers that already loaded characters (such as Timeline) can supply
    // their lookup promise, so both queries remain parallel without a second
    // complete character collection read.
    characterNameById ??
      getAllCharacters(novelId).then(
        (characters) =>
          new Map(
            characters.map((character) => [character.id, character.name]),
          ),
      ),
  ]);
  return snapshot.docs.map((d) =>
    toEvent(novelId, d.id, d.data() as EventDoc, nameById),
  );
}

export async function getEventsByChapter(
  novelId: string,
  chapterId: string,
): Promise<NovelEvent[]> {
  const snapshot = await getDocs(
    query(eventsCol(novelId), where("chapter_id", "==", chapterId)),
  );
  return snapshot.docs
    .map((item) =>
      toEvent(novelId, item.id, item.data() as EventDoc, new Map()),
    )
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order || left.id.localeCompare(right.id),
    );
}

export async function getEventsByVolume(
  novelId: string,
  volumeId: string,
): Promise<NovelEvent[]> {
  const snapshot = await getDocs(
    query(eventsCol(novelId), where("chapter_volume_id", "==", volumeId)),
  );
  return snapshot.docs
    .map((item) =>
      toEvent(novelId, item.id, item.data() as EventDoc, new Map()),
    )
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order || left.id.localeCompare(right.id),
    );
}

export async function getEventsForCharacter(
  novelId: string,
  characterId: string,
): Promise<NovelEvent[]> {
  const snapshot = await getDocs(eventsCol(novelId));
  return eventsForCharacter(
    snapshot.docs
      .map((item) =>
        toEvent(novelId, item.id, item.data() as EventDoc, new Map()),
      )
      .sort(
        (left, right) =>
          left.sort_order - right.sort_order || left.id.localeCompare(right.id),
      ),
    characterId,
  );
}

export async function getEventsForEntity(
  novelId: string,
  entityId: EntityId,
): Promise<NovelEvent[]> {
  const snapshot = await getDocs(eventsCol(novelId));
  return eventsForEntity(
    snapshot.docs
      .map((item) => toEvent(novelId, item.id, item.data() as EventDoc, new Map()))
      .sort(
        (left, right) =>
          left.sort_order - right.sort_order || left.id.localeCompare(right.id),
      ),
    entityId,
  );
}

export async function deleteEvent(
  novelId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(eventRef(novelId, eventId));
}
