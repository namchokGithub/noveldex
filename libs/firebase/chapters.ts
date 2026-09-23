import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore/lite";
import type {
  Chapter,
  ChapterKind,
  ChapterNote,
  ChapterSummary,
  ChapterWithCharacters,
  Tag,
} from "@/app/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { CHAPTER_KINDS } from "@/libs/chapterLabel";
import { db } from "./app";
import { getCharactersByIds } from "./characters";
import { firestoreEntityLookup } from "@/libs/entities/firestoreLookup";
import { parseEntityId } from "@/libs/entities/keys";
import { reconcileReferenceOccurrences } from "@/libs/entities/reconcile";
import type {
  EntityLookup,
  ReferenceOccurrence,
} from "@/libs/entities/references";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getTags, getTagsByIds } from "./tags";
import { notesForEntity } from "@/libs/entityCrossReferences";
import type { EntityId } from "@/libs/entities/types";
import {
  applyCharacterChapterCountDeltas,
  applyChapterCounterDelta,
  chapterCounterContribution,
  chapterCounterDelta,
} from "./counters";
import {
  deleteEntityReferences,
  referencesForChapterNotes,
  replaceEntityReferences,
} from "./entityReferences";

interface ChapterDoc {
  number: number | null;
  sort_order?: number;
  kind?: ChapterKind;
  custom_label?: string | null;
  // `title` is retained for documents written before bilingual titles.
  title?: string;
  title_en?: string;
  title_th?: string;
  summary: string;
  description?: string;
  notes?: ChapterNoteDoc[];
  read_at: Timestamp | null;
  event_count?: number;
  novel_id: string;
  volume_id: string;
  tag_ids: string[];
  character_ids: string[];
  character_mention_counts?: Record<string, number>;
  mentioned_character_names?: string[];
  mentioned_character_name_counts?: Record<string, number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CUSTOM_LABEL_LENGTH = 80;

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

function chapterKind(value: ChapterKind | undefined): ChapterKind {
  return value && CHAPTER_KINDS.includes(value) ? value : "chapter";
}

function validateEntry(
  kind: ChapterKind,
  number: number | null,
  customLabel: string | null,
) {
  if (kind === "chapter" && (!Number.isInteger(number) || (number ?? 0) < 1)) {
    throw new Error("chapter number must be a positive integer");
  }
  if (kind !== "chapter" && number !== null)
    throw new Error("special entries cannot have a chapter number");
  if (kind === "other" && !customLabel?.trim())
    throw new Error("a custom label is required for Other");
  if (customLabel && customLabel.length > MAX_CUSTOM_LABEL_LENGTH) {
    throw new Error(
      `custom label must be ${MAX_CUSTOM_LABEL_LENGTH} characters or fewer`,
    );
  }
}

interface ChapterNoteDoc {
  id: string;
  content: string;
  content_json?: ChapterNote["content_json"];
  character_ids?: string[];
  mentioned_character_names?: string[];
  references?: ReferenceOccurrence[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function notesForChapter(data: ChapterDoc): ChapterNote[] {
  if (data.notes)
    return data.notes
      .map((note) => ({
        id: note.id,
        content: note.content,
        content_json: note.content_json,
        character_ids: note.character_ids ?? [],
        mentioned_character_names: note.mentioned_character_names ?? [],
        references: note.references,
        created_at: tsToIso(note.created_at),
        updated_at: tsToIso(note.updated_at),
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!data.summary) return [];
  return [
    {
      id: "legacy-summary",
      content: data.summary,
      character_ids: [],
      created_at: tsToIso(data.created_at),
      updated_at: tsToIso(data.updated_at),
    },
  ];
}

function notesToDoc(notes: ChapterNote[]): ChapterNoteDoc[] {
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

function chaptersCol(novelId: string, volumeId: string) {
  return collection(db, "novels", novelId, "volumes", volumeId, "chapters");
}

function chapterRef(novelId: string, volumeId: string, chapterId: string) {
  return doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId);
}

function markerRef(novelId: string, volumeId: string, number: number) {
  return doc(
    db,
    "novels",
    novelId,
    "volumes",
    volumeId,
    "chapterNumbers",
    String(number),
  );
}

function characterIdDelta(before: readonly string[], after: readonly string[]) {
  const beforeIds = new Set(before);
  const afterIds = new Set(after);
  return [
    ...[...afterIds]
      .filter((id) => !beforeIds.has(id))
      .map((characterId) => ({ characterId, delta: 1 })),
    ...[...beforeIds]
      .filter((id) => !afterIds.has(id))
      .map((characterId) => ({ characterId, delta: -1 })),
  ];
}

function toChapter(id: string, data: ChapterDoc, tags: Tag[]): Chapter {
  const notes = notesForChapter(data);
  const kind = chapterKind(data.kind);
  const title_en = data.title_en ?? data.title ?? "";
  const title_th = data.title_th ?? "";
  return {
    id,
    volume_id: data.volume_id,
    number: data.number,
    sort_order: data.sort_order ?? data.number ?? 0,
    kind,
    custom_label: data.custom_label ?? null,
    title: title_en,
    title_en,
    title_th,
    // Keep the legacy field populated for older callers, but make notes canonical.
    summary: notes.map((note) => note.content).join("\n") || data.summary || "",
    description: data.description ?? "",
    notes,
    read_at: data.read_at ? tsToIso(data.read_at) : null,
    event_count: data.event_count ?? 0,
    tags,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

function resolveTags(tagIds: string[], byId: Map<string, Tag>): Tag[] {
  return tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t));
}

async function tagsForChapter(
  novelId: string,
  tagIds: string[],
): Promise<Tag[]> {
  if (tagIds.length === 0) return [];
  const tags = await getTagsByIds(novelId, tagIds);
  return resolveTags(tagIds, new Map(tags.map((tag) => [tag.id, tag])));
}

async function hydrateNoteReferences(
  novelId: string,
  notes: ChapterNoteDoc[],
  lookup: EntityLookup = firestoreEntityLookup(),
): Promise<ChapterNoteDoc[]> {
  return Promise.all(
    notes.map(async (note) =>
      note.references !== undefined
        ? note
        : {
            ...note,
            references: await reconcileReferenceOccurrences(
              novelId,
              note.content,
              null,
              lookup,
            ),
          },
    ),
  );
}

async function hydrateChapterNotes(
  novelId: string,
  data: ChapterDoc,
  lookup?: EntityLookup,
): Promise<ChapterNoteDoc[] | undefined> {
  if (data.notes === undefined) return undefined;
  return hydrateNoteReferences(novelId, data.notes, lookup);
}

function characterMentionNames(references: ReferenceOccurrence[]) {
  return [
    ...new Set(
      references.flatMap((occurrence) => {
        if (occurrence.token.status === "resolved") {
          return occurrence.token.reference.entityType === "character"
            ? [occurrence.token.reference.label]
            : [];
        }
        return occurrence.token.typed === null ||
          occurrence.token.typed === "character"
          ? [occurrence.token.label]
          : [];
      }),
    ),
  ];
}

function legacyCharacterFields(references: ReferenceOccurrence[]) {
  const characterIds = references.flatMap((occurrence) => {
    if (
      occurrence.token.status !== "resolved" ||
      occurrence.token.reference.entityType !== "character"
    )
      return [];
    const parsed = parseEntityId(occurrence.token.reference.entityId);
    return parsed ? [parsed.sourceRecordId] : [];
  });
  return {
    character_ids: [...new Set(characterIds)],
    mentioned_character_names: characterMentionNames(references),
  };
}

async function resolveNotes(
  novelId: string,
  notes: ChapterNote[],
  previousById: Map<string, ChapterNoteDoc>,
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
      return { ...note, references, ...legacyCharacterFields(references) };
    }),
  );
}

function incrementCounts(
  counts: Map<string, number>,
  characterIds: string[],
  amount: number,
): void {
  characterIds.forEach((id) => {
    const next = (counts.get(id) ?? 0) + amount;
    if (next <= 0) counts.delete(id);
    else counts.set(id, next);
  });
}

export async function getChaptersByVolume(
  novelId: string,
  volumeId: string,
): Promise<Chapter[]> {
  const snapshot = await getDocs(chaptersCol(novelId, volumeId));
  const chapterDocs = snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as ChapterDoc,
  }));
  // The volume list and filter only need tags referenced by its chapters.
  const allTags = await getTagsByIds(
    novelId,
    chapterDocs.flatMap((chapter) => chapter.data.tag_ids ?? []),
  );
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const lookup = firestoreEntityLookup();
  return (
    await Promise.all(
      chapterDocs.map(async ({ id, data }) => {
        const notes = await hydrateChapterNotes(novelId, data, lookup);
        return toChapter(
          id,
          notes === undefined ? data : { ...data, notes },
          resolveTags(data.tag_ids ?? [], byId),
        );
      }),
    )
  ).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getChaptersFlat(
  novelId: string,
): Promise<ChapterSummary[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "chapters"), where("novel_id", "==", novelId)),
  );
  return snapshot.docs
    .map((d) => {
      const data = d.data() as {
        volume_id: string;
        number: number | null;
        sort_order?: number;
        kind?: ChapterKind;
        custom_label?: string | null;
        title?: string;
        title_en?: string;
        title_th?: string;
        summary?: string;
        notes?: ChapterNoteDoc[];
        read_at: Timestamp | null;
        character_ids?: string[];
      };
      return {
        id: d.id,
        volume_id: data.volume_id,
        number: data.number,
        sort_order: data.sort_order ?? data.number ?? 0,
        kind: chapterKind(data.kind),
        custom_label: data.custom_label ?? null,
        title: data.title_en || data.title || "",
        title_en: data.title_en ?? data.title ?? "",
        title_th: data.title_th ?? "",
        summary:
          data.notes?.map((note) => note.content).join("\n") ??
          data.summary ??
          "",
        read_at: data.read_at ? tsToIso(data.read_at) : null,
        character_ids: data.character_ids ?? [],
      };
    })
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (a.number ?? Number.MAX_SAFE_INTEGER) -
          (b.number ?? Number.MAX_SAFE_INTEGER),
    );
}

// Search needs the canonical chapter form, including notes, tags, and persisted
// reference occurrences.  Keep this separate from the lighter list-page shape.
export async function getChaptersFlatDetailed(
  novelId: string,
): Promise<Chapter[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "chapters"), where("novel_id", "==", novelId)),
  );
  const allTags = await getTags(novelId);
  const tagsById = new Map(allTags.map((tag) => [tag.id, tag]));
  const lookup = firestoreEntityLookup();
  const chapters = await Promise.all(
    snapshot.docs.map(async (snapshot) => {
      const data = snapshot.data() as ChapterDoc;
      const notes = await hydrateChapterNotes(novelId, data, lookup);
      return toChapter(
        snapshot.id,
        notes === undefined ? data : { ...data, notes },
        resolveTags(data.tag_ids ?? [], tagsById),
      );
    }),
  );
  return chapters.sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      (a.number ?? Number.MAX_SAFE_INTEGER) -
        (b.number ?? Number.MAX_SAFE_INTEGER),
  );
}

export interface EntityRelatedChapterNote {
  chapter: ChapterSummary;
  note: ChapterNote;
}

export async function getChapterNotesForEntity(
  novelId: string,
  entityId: EntityId,
): Promise<EntityRelatedChapterNote[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "chapters"), where("novel_id", "==", novelId)),
  );
  const entries = snapshot.docs.flatMap((document) => {
    const data = document.data() as ChapterDoc;
    const chapter: ChapterSummary = {
      id: document.id,
      volume_id: data.volume_id,
      number: data.number,
      sort_order: data.sort_order ?? data.number ?? 0,
      kind: chapterKind(data.kind),
      custom_label: data.custom_label ?? null,
      title: data.title_en ?? data.title ?? "",
      title_en: data.title_en ?? data.title ?? "",
      title_th: data.title_th ?? "",
      read_at: data.read_at ? tsToIso(data.read_at) : null,
    };
    return notesForEntity<
      ChapterNoteDoc,
      { chapter: ChapterSummary; notes: ChapterNoteDoc[] }
    >([{ chapter, notes: data.notes ?? [] }], entityId).map(
      ({ chapter: source, note }) => ({
        chapter: source.chapter,
        note: {
          id: note.id,
          content: note.content,
          character_ids: note.character_ids ?? [],
          mentioned_character_names: note.mentioned_character_names ?? [],
          references: note.references ?? [],
          created_at: tsToIso(note.created_at),
          updated_at: tsToIso(note.updated_at),
        },
      }),
    );
  });
  return entries.sort(
    (left, right) =>
      left.chapter.sort_order - right.chapter.sort_order ||
      left.note.created_at.localeCompare(right.note.created_at),
  );
}

export async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  includeCharacters = true,
): Promise<ChapterWithCharacters> {
  const snapshot = await getDoc(chapterRef(novelId, volumeId, chapterId));
  if (!snapshot.exists()) {
    throw new ResourceNotFoundError("chapter");
  }
  const data = snapshot.data() as ChapterDoc;
  const tags = await tagsForChapter(novelId, data.tag_ids ?? []);
  const notes = await hydrateChapterNotes(novelId, data);
  const chapter = toChapter(
    snapshot.id,
    notes === undefined ? data : { ...data, notes },
    tags,
  );
  const mentioned_character_names = [
    ...new Set([
      ...(data.mentioned_character_names ?? []),
      ...chapter.notes.flatMap((note) =>
        note.references
          ? characterMentionNames(note.references)
          : (note.mentioned_character_names ?? []),
      ),
    ]),
  ];
  const characters =
    !includeCharacters || (data.character_ids ?? []).length === 0
      ? []
      : await getCharactersByIds(novelId, data.character_ids ?? []).catch(
          () => [],
        );
  return {
    ...chapter,
    character_ids: data.character_ids ?? [],
    characters,
    mentioned_character_names,
  };
}

export interface ChapterCreatePayload {
  number?: number | null;
  kind?: ChapterKind;
  custom_label?: string | null;
  title_en: string;
  title_th?: string;
  summary?: string;
  description?: string;
  notes?: ChapterNote[];
  read_at?: string | null;
}

export async function createChapter(
  novelId: string,
  volumeId: string,
  payload: ChapterCreatePayload,
): Promise<Chapter> {
  validateDescription(payload.description);
  const title_en = payload.title_en.trim();
  if (!title_en) throw new Error("English chapter title is required");
  const title_th = payload.title_th?.trim() ?? "";
  const kind = chapterKind(payload.kind);
  const number = kind === "chapter" ? (payload.number ?? null) : null;
  const customLabel =
    kind === "other" ? (payload.custom_label?.trim() ?? null) : null;
  validateEntry(kind, number, customLabel);
  const chapterRefNew = doc(chaptersCol(novelId, volumeId));
  const existingInVolume = await getDocs(chaptersCol(novelId, volumeId));
  const sortOrder =
    existingInVolume.docs.reduce(
      (largest, document) =>
        Math.max(
          largest,
          (document.data() as ChapterDoc).sort_order ??
            (document.data() as ChapterDoc).number ??
            0,
        ),
      0,
    ) + 1;
  const now = new Date().toISOString();
  const rawNotes =
    payload.notes ??
    (payload.summary
      ? [
          {
            id: crypto.randomUUID(),
            content: payload.summary,
            created_at: now,
            updated_at: now,
          },
        ]
      : []);
  const notes = await resolveNotes(novelId, rawNotes, new Map());
  const counts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  notes.forEach((note) => {
    incrementCounts(counts, note.character_ids ?? [], 1);
    incrementCounts(nameCounts, note.mentioned_character_names ?? [], 1);
  });
  const readAt = payload.read_at
    ? Timestamp.fromDate(new Date(payload.read_at))
    : null;

  await runTransaction(db, async (tx) => {
    const volumeSnapshot = await tx.get(
      doc(db, "novels", novelId, "volumes", volumeId),
    );
    if (
      !volumeSnapshot.exists() ||
      (volumeSnapshot.data() as { deleting?: boolean }).deleting === true
    ) {
      throw new Error("Volume is being deleted.");
    }
    let marker: ReturnType<typeof markerRef> | null = null;
    if (number !== null) {
      marker = markerRef(novelId, volumeId, number);
      const existing = await tx.get(marker);
      if (existing.exists())
        throw new Error("chapter number already exists in this volume");
    }
    await applyCharacterChapterCountDeltas(
      tx,
      novelId,
      [...counts.keys()].map((characterId) => ({ characterId, delta: 1 })),
    );
    if (marker !== null) tx.set(marker, { chapter_id: chapterRefNew.id });
    const chapterData = withCreateTimestamps({
      number,
      sort_order: sortOrder,
      kind,
      custom_label: customLabel,
      // Keep the former field in sync for older callers and existing data.
      title: title_en,
      title_en,
      title_th,
      summary: payload.summary ?? "",
      description: payload.description ?? "",
      notes: notesToDoc(notes),
      read_at: readAt,
      event_count: 0,
      novel_id: novelId,
      volume_id: volumeId,
      tag_ids: [],
      character_ids: [...counts.keys()],
      character_mention_counts: Object.fromEntries(counts),
      mentioned_character_names: [...nameCounts.keys()],
      mentioned_character_name_counts: Object.fromEntries(nameCounts),
    });
    tx.set(chapterRefNew, chapterData);
    await replaceEntityReferences(
      tx,
      novelId,
      [],
      referencesForChapterNotes({
        sourceId: chapterRefNew.id,
        volumeId,
        title: title_en,
        sortOrder,
        updatedAt: now,
        notes,
      }),
    );
    applyChapterCounterDelta(
      tx,
      novelId,
      volumeId,
      chapterCounterContribution({ kind, read_at: readAt }),
    );
  });

  const snapshot = await getDoc(chapterRefNew);
  return toChapter(snapshot.id, snapshot.data() as ChapterDoc, []);
}

export interface ChapterPayload {
  number?: number | null;
  kind?: ChapterKind;
  custom_label?: string | null;
  /** Legacy title input; treated as the English title. */
  title?: string;
  title_en?: string;
  title_th?: string;
  summary?: string;
  description?: string;
  notes?: ChapterNote[];
  read_at?: string | null;
}

export async function updateChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  payload: ChapterPayload,
): Promise<Chapter> {
  validateDescription(payload.description);
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) {
    update.title = payload.title;
    update.title_en = payload.title;
  }
  if (payload.title_en !== undefined) {
    const title_en = payload.title_en.trim();
    if (!title_en) throw new Error("English chapter title is required");
    update.title = title_en;
    update.title_en = title_en;
  }
  if (payload.title_th !== undefined) update.title_th = payload.title_th.trim();
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.description !== undefined)
    update.description = payload.description;
  if (payload.read_at !== undefined) {
    update.read_at = payload.read_at
      ? Timestamp.fromDate(new Date(payload.read_at))
      : null;
  }

  if (payload.notes !== undefined) {
    const ref = chapterRef(novelId, volumeId, chapterId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) throw new Error("Request failed.");
    const data = snapshot.data() as ChapterDoc;
    const previousNotes = await hydrateNoteReferences(
      novelId,
      data.notes ?? [],
    );
    const previousById = new Map(previousNotes.map((note) => [note.id, note]));
    const notes = await resolveNotes(novelId, payload.notes, previousById);
    const counts = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    notes.forEach((note) => {
      incrementCounts(counts, note.character_ids ?? [], 1);
      incrementCounts(nameCounts, note.mentioned_character_names ?? [], 1);
    });

    update.notes = notesToDoc(notes);
    update.character_ids = [...counts.keys()];
    update.character_mention_counts = Object.fromEntries(counts);
    update.mentioned_character_names = [...nameCounts.keys()];
    update.mentioned_character_name_counts = Object.fromEntries(nameCounts);
  }

  const changesCountedState =
    payload.notes !== undefined ||
    payload.read_at !== undefined ||
    payload.kind !== undefined ||
    payload.number !== undefined ||
    payload.custom_label !== undefined;
  const changesIndexedState =
    payload.notes !== undefined ||
    payload.title !== undefined ||
    payload.title_en !== undefined ||
    payload.title_th !== undefined;
  if (!changesCountedState && !changesIndexedState) {
    await updateDoc(
      chapterRef(novelId, volumeId, chapterId),
      withUpdateTimestamp(update),
    );
  } else {
    await runTransaction(db, async (tx) => {
      const ref = chapterRef(novelId, volumeId, chapterId);
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error("Request failed.");
      const current = snapshot.data() as ChapterDoc;
      const currentKind = chapterKind(current.kind);
      const kind = chapterKind(payload.kind ?? currentKind);
      const readAt =
        payload.read_at !== undefined
          ? (update.read_at as Timestamp | null)
          : current.read_at;
      const number =
        kind === "chapter" ? (payload.number ?? current.number) : null;
      const customLabel =
        kind === "other"
          ? (payload.custom_label ?? current.custom_label ?? "").trim()
          : null;
      validateEntry(kind, number, customLabel);

      let nextMarker: ReturnType<typeof markerRef> | null = null;
      if (current.number !== number && number !== null) {
        nextMarker = markerRef(novelId, volumeId, number);
        const existing = await tx.get(nextMarker);
        if (existing.exists() && existing.data().chapter_id !== chapterId)
          throw new Error("chapter number already exists in this volume");
      }

      const nextCharacterIds = Array.isArray(update.character_ids)
        ? (update.character_ids as string[])
        : (current.character_ids ?? []);
      await applyCharacterChapterCountDeltas(
        tx,
        novelId,
        characterIdDelta(current.character_ids ?? [], nextCharacterIds),
      );

      if (current.number !== number) {
        if (current.number !== null)
          tx.delete(markerRef(novelId, volumeId, current.number));
        if (nextMarker !== null) tx.set(nextMarker, { chapter_id: chapterId });
      }
      tx.update(
        ref,
        withUpdateTimestamp({
          ...update,
          kind,
          number,
          custom_label: customLabel,
        }),
      );
      if (changesIndexedState) {
        const nextNotes =
          (update.notes as ChapterNoteDoc[] | undefined) ?? current.notes ?? [];
        await replaceEntityReferences(
          tx,
          novelId,
          referencesForChapterNotes({
            sourceId: chapterId,
            volumeId,
            title: current.title_en ?? current.title ?? "",
            sortOrder: current.sort_order ?? current.number ?? 0,
            updatedAt: tsToIso(current.updated_at),
            notes: current.notes ?? [],
          }),
          referencesForChapterNotes({
            sourceId: chapterId,
            volumeId,
            title:
              (update.title_en as string | undefined) ??
              (update.title as string | undefined) ??
              current.title_en ??
              current.title ??
              "",
            sortOrder: current.sort_order ?? current.number ?? 0,
            updatedAt: new Date().toISOString(),
            notes: nextNotes,
          }),
        );
      }
      applyChapterCounterDelta(
        tx,
        novelId,
        volumeId,
        chapterCounterDelta(
          { kind: current.kind, read_at: current.read_at },
          { kind, read_at: readAt },
        ),
      );
    });
  }
  const snapshot = await getDoc(chapterRef(novelId, volumeId, chapterId));
  if (!snapshot.exists()) throw new Error("Request failed.");
  const data = snapshot.data() as ChapterDoc;
  const tags = await tagsForChapter(novelId, data.tag_ids ?? []);
  const notes = await hydrateChapterNotes(novelId, data);
  return toChapter(
    snapshot.id,
    notes === undefined ? data : { ...data, notes },
    tags,
  );
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
    const current = snapshot.data() as ChapterDoc;
    const { number } = current;
    await applyCharacterChapterCountDeltas(
      tx,
      novelId,
      (current.character_ids ?? []).map((characterId) => ({
        characterId,
        delta: -1,
      })),
    );
    await deleteEntityReferences(
      tx,
      novelId,
      referencesForChapterNotes({
        sourceId: chapterId,
        volumeId,
        title: current.title_en ?? current.title ?? "",
        sortOrder: current.sort_order ?? current.number ?? 0,
        updatedAt: tsToIso(current.updated_at),
        notes: current.notes ?? [],
      }),
    );
    tx.delete(ref);
    if (number !== null) tx.delete(markerRef(novelId, volumeId, number));
    const contribution = chapterCounterContribution({
      kind: current.kind,
      read_at: current.read_at,
    });
    applyChapterCounterDelta(tx, novelId, volumeId, {
      chapter_count: -contribution.chapter_count,
      read_count: -contribution.read_count,
    });
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
  sort_order: number;
}

export async function reorderChapters(
  novelId: string,
  volumeId: string,
  entries: ChapterOrderEntry[],
): Promise<void> {
  const batch = writeBatch(db);
  entries.forEach((entry) => {
    batch.update(chapterRef(novelId, volumeId, entry.id), {
      sort_order: entry.sort_order,
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
}
