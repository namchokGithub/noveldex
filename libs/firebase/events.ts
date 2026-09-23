import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
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
import { getAllCharacters, getCharactersByIds } from "./characters";
import { applyNonNegativeCounterDeltas } from "./counters";
import { chapterEventOrder } from "@/libs/timelineOrder";
import {
  deleteEntityReferences,
  referencesForEvent,
  replaceEntityReferences,
} from "./entityReferences";

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

type EventCounterTarget = { volumeId: string; chapterId: string };

function eventCounterTarget(event: {
  chapter_id?: string | null;
  chapter_volume_id?: string | null;
}): EventCounterTarget | null {
  return event.chapter_id && event.chapter_volume_id
    ? { volumeId: event.chapter_volume_id, chapterId: event.chapter_id }
    : null;
}

function eventCounterDeltas(
  novelId: string,
  target: EventCounterTarget | null,
  delta: number,
) {
  if (!target || delta === 0) return [];
  return [
    {
      reference: doc(db, "novels", novelId, "volumes", target.volumeId),
      field: "event_count" as const,
      delta,
    },
    {
      reference: doc(
        db,
        "novels",
        novelId,
        "volumes",
        target.volumeId,
        "chapters",
        target.chapterId,
      ),
      field: "event_count" as const,
      delta,
    },
  ];
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
  const ref = doc(eventsCol(novelId));
  const event = withCreateTimestamps({
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
  });
  await runTransaction(db, async (transaction) => {
    await replaceEntityReferences(
      transaction,
      novelId,
      [],
      referencesForEvent({
        eventId: ref.id,
        title: event.title,
        sortOrder: event.sort_order,
        updatedAt: new Date().toISOString(),
        references: event.description_references,
      }),
    );
    await applyNonNegativeCounterDeltas(
      transaction,
      eventCounterDeltas(novelId, eventCounterTarget(chapterFields), 1),
    );
    transaction.set(ref, event);
  });
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
  const ref = eventRef(novelId, eventId) as DocumentReference<
    EventDoc,
    EventDoc
  >;
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
  let nextTarget: EventCounterTarget | null | undefined;
  if (payload.chapter_id !== undefined) {
    const chapterFields = await resolveChapterFields(
      novelId,
      payload.chapter_id,
      payload.chapter_volume_id,
    );
    Object.assign(update, chapterFields);
    nextTarget = eventCounterTarget(chapterFields);
  }

  const changesIndexedState =
    payload.description !== undefined ||
    payload.title !== undefined ||
    payload.sort_order !== undefined;
  await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(ref);
    if (!previous.exists()) throw new Error("Request failed.");
    const previousTarget = eventCounterTarget(previous.data());
    if (changesIndexedState) {
      const current = previous.data();
      await replaceEntityReferences(
        transaction,
        novelId,
        referencesForEvent({
          eventId,
          title: current.title,
          sortOrder: current.sort_order,
          updatedAt: tsToIso(current.updated_at),
          references: current.description_references,
        }),
        referencesForEvent({
          eventId,
          title: (update.title as string | undefined) ?? current.title,
          sortOrder:
            (update.sort_order as number | undefined) ?? current.sort_order,
          updatedAt: new Date().toISOString(),
          references:
            (update.description_references as
              | ReferenceOccurrence[]
              | undefined) ?? current.description_references,
        }),
      );
    }
    await applyNonNegativeCounterDeltas(transaction, [
      ...eventCounterDeltas(novelId, previousTarget, -1),
      ...eventCounterDeltas(
        novelId,
        nextTarget === undefined ? previousTarget : nextTarget,
        1,
      ),
    ]);
    transaction.update(ref, withUpdateTimestamp(update));
  });
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
  const snapshot = await getDocs(
    query(eventsCol(novelId), orderBy("sort_order", "asc")),
  );
  const eventDocs = snapshot.docs.map((item) => ({
    id: item.id,
    data: item.data() as EventDoc,
  }));
  const nameById = await (characterNameById ??
    getCharactersByIds(
      novelId,
      eventDocs.flatMap((event) => event.data.character_ids ?? []),
    ).then(
      (characters) =>
        new Map(characters.map((character) => [character.id, character.name])),
    ));
  return eventDocs.map((event) =>
    toEvent(novelId, event.id, event.data, nameById),
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
    .sort(chapterEventOrder);
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
      .map((item) =>
        toEvent(novelId, item.id, item.data() as EventDoc, new Map()),
      )
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
  const ref = eventRef(novelId, eventId) as DocumentReference<
    EventDoc,
    EventDoc
  >;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    const current = snapshot.data();
    await deleteEntityReferences(
      transaction,
      novelId,
      referencesForEvent({
        eventId,
        title: current.title,
        sortOrder: current.sort_order,
        updatedAt: tsToIso(current.updated_at),
        references: current.description_references,
      }),
    );
    await applyNonNegativeCounterDeltas(
      transaction,
      eventCounterDeltas(novelId, eventCounterTarget(snapshot.data()), -1),
    );
    transaction.delete(ref);
  });
}
