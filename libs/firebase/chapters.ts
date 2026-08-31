import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Chapter, ChapterNote, ChapterSummary, ChapterWithCharacters, Tag } from "@/app/types";
import { db } from "./app";
import { getCharactersByIds, getCharactersByNames } from "./characters";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { extractMentions } from "./mentions";
import { getTags } from "./tags";

interface ChapterDoc {
  number: number;
  title: string;
  summary: string;
  notes?: ChapterNoteDoc[];
  read_at: Timestamp | null;
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

interface ChapterNoteDoc {
  id: string;
  content: string;
  character_ids?: string[];
  mentioned_character_names?: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

function notesForChapter(data: ChapterDoc): ChapterNote[] {
  if (data.notes) return data.notes
    .map((note) => ({ id: note.id, content: note.content, created_at: tsToIso(note.created_at), updated_at: tsToIso(note.updated_at) }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!data.summary) return [];
  return [{ id: "legacy-summary", content: data.summary, character_ids: [], created_at: tsToIso(data.created_at), updated_at: tsToIso(data.updated_at) }];
}

function notesToDoc(notes: ChapterNote[]): ChapterNoteDoc[] {
  return [...notes]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((note) => ({ id: note.id, content: note.content, character_ids: note.character_ids ?? [], mentioned_character_names: note.mentioned_character_names ?? [], created_at: Timestamp.fromDate(new Date(note.created_at)), updated_at: Timestamp.fromDate(new Date(note.updated_at)) }));
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
  const notes = notesForChapter(data);
  return {
    id,
    volume_id: data.volume_id,
    number: data.number,
    title: data.title,
    // Keep the legacy field populated for older callers, but make notes canonical.
    summary: notes.map((note) => note.content).join("\n") || data.summary || "",
    notes,
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

async function hydrateLegacyNoteRelations(novelId: string, notes: ChapterNoteDoc[]): Promise<ChapterNoteDoc[]> {
  const legacyNotes = notes.filter((note) => note.character_ids === undefined || note.mentioned_character_names === undefined);
  if (legacyNotes.length === 0) return notes;
  const names = [...new Set(legacyNotes.flatMap((note) => extractMentions(note.content)))];
  const characters = await getCharactersByNames(novelId, names);
  const idByName = new Map(characters.map((character) => [character.name, character.id]));
  return notes.map((note) => {
    if (note.character_ids !== undefined && note.mentioned_character_names !== undefined) return note;
    const mentioned_character_names = [...new Set(extractMentions(note.content))];
    return {
      ...note,
      character_ids: [...new Set(mentioned_character_names.map((name) => idByName.get(name)).filter((id): id is string => Boolean(id)))],
      mentioned_character_names,
    };
  });
}

async function resolveChangedNoteRelations(
  novelId: string,
  notes: ChapterNote[],
  previousById: Map<string, ChapterNoteDoc>,
): Promise<ChapterNote[]> {
  const changed = notes.filter((note) => previousById.get(note.id)?.content !== note.content);
  const names = [...new Set(changed.flatMap((note) => extractMentions(note.content)))];
  const characters = await getCharactersByNames(novelId, names);
  const idByName = new Map(characters.map((character) => [character.name, character.id]));
  return notes.map((note) => {
    const previous = previousById.get(note.id);
    if (previous?.content === note.content) return { ...note, character_ids: previous.character_ids ?? [], mentioned_character_names: previous.mentioned_character_names ?? [] };
    const mentioned_character_names = [...new Set(extractMentions(note.content))];
    return {
      ...note,
      character_ids: [...new Set(mentioned_character_names.map((name) => idByName.get(name)).filter((id): id is string => Boolean(id)))],
      mentioned_character_names,
    };
  });
}

function incrementCounts(counts: Map<string, number>, characterIds: string[], amount: number): void {
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
  const snapshot = await getDocs(
    query(chaptersCol(novelId, volumeId), orderBy("number", "asc")),
  );
  // Fetch the novel's tags exactly once (not per chapter) to avoid N+1 reads.
  const allTags = await getTags(novelId);
  const byId = new Map(allTags.map((t) => [t.id, t]));
  return snapshot.docs.map((d) => {
    const data = d.data() as ChapterDoc;
    return toChapter(d.id, data, resolveTags(data.tag_ids ?? [], byId));
  });
}

export async function getChaptersFlat(novelId: string): Promise<ChapterSummary[]> {
  const snapshot = await getDocs(
    query(
      collectionGroup(db, "chapters"),
      where("novel_id", "==", novelId),
      orderBy("number", "asc"),
    ),
  );
  return snapshot.docs.map((d) => {
    const data = d.data() as {
      volume_id: string;
      number: number;
      title: string;
      summary?: string;
      notes?: ChapterNoteDoc[];
      read_at: Timestamp | null;
      character_ids?: string[];
    };
    return {
      id: d.id,
      volume_id: data.volume_id,
      number: data.number,
      title: data.title,
      summary: data.notes?.map((note) => note.content).join("\n") ?? data.summary ?? "",
      read_at: data.read_at ? tsToIso(data.read_at) : null,
      character_ids: data.character_ids ?? [],
    };
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
  const tags = await tagsForChapter(novelId, data.tag_ids ?? []);
  const chapter = toChapter(snapshot.id, data, tags);
  const mentioned_character_names = data.mentioned_character_names ?? [...new Set(chapter.notes.flatMap((note) => extractMentions(note.content)))];
  const characters =
    (data.character_ids ?? []).length === 0
      ? []
      : await getCharactersByIds(novelId, data.character_ids ?? []).catch(() => []);
  return { ...chapter, characters, mentioned_character_names };
}

export interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  notes?: ChapterNote[];
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
    const now = new Date().toISOString();
    const notes = payload.notes ?? (payload.summary ? [{ id: crypto.randomUUID(), content: payload.summary, created_at: now, updated_at: now }] : []);
    tx.set(
      chapterRefNew,
      withCreateTimestamps({
        number: payload.number,
        title: payload.title,
        summary: payload.summary ?? "",
        notes: notesToDoc(notes),
        read_at: payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null,
        novel_id: novelId,
        volume_id: volumeId,
        tag_ids: [],
        character_ids: [],
        character_mention_counts: {},
        mentioned_character_names: [],
        mentioned_character_name_counts: {},
      }),
    );
  });

  const snapshot = await getDoc(chapterRefNew);
  return toChapter(snapshot.id, snapshot.data() as ChapterDoc, []);
}

export interface ChapterPayload {
  title?: string;
  summary?: string;
  notes?: ChapterNote[];
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

  if (payload.notes !== undefined) {
    const ref = chapterRef(novelId, volumeId, chapterId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) throw new Error("Request failed.");
    const data = snapshot.data() as ChapterDoc;
    const previousNotes = await hydrateLegacyNoteRelations(novelId, data.notes ?? []);
    const previousById = new Map(previousNotes.map((note) => [note.id, note]));
    const notes = await resolveChangedNoteRelations(novelId, payload.notes, previousById);
    const nextById = new Map(notes.map((note) => [note.id, note]));
    const counts = new Map(Object.entries(data.character_mention_counts ?? {}).filter(([, count]) => count > 0));
    const nameCounts = new Map(Object.entries(data.mentioned_character_name_counts ?? {}).filter(([, count]) => count > 0));

    if (data.character_mention_counts === undefined) {
      counts.clear();
      previousNotes.forEach((note) => incrementCounts(counts, note.character_ids ?? [], 1));
    }
    if (data.mentioned_character_name_counts === undefined) {
      nameCounts.clear();
      previousNotes.forEach((note) => incrementCounts(nameCounts, note.mentioned_character_names ?? [], 1));
    }
    previousNotes.forEach((note) => {
      const next = nextById.get(note.id);
      if (!next || JSON.stringify(note.character_ids ?? []) !== JSON.stringify(next.character_ids ?? [])) {
        incrementCounts(counts, note.character_ids ?? [], -1);
      }
      if (!next || JSON.stringify(note.mentioned_character_names ?? []) !== JSON.stringify(next.mentioned_character_names ?? [])) {
        incrementCounts(nameCounts, note.mentioned_character_names ?? [], -1);
      }
    });
    notes.forEach((note) => {
      const previous = previousById.get(note.id);
      if (!previous || JSON.stringify(previous.character_ids ?? []) !== JSON.stringify(note.character_ids ?? [])) {
        incrementCounts(counts, note.character_ids ?? [], 1);
      }
      if (!previous || JSON.stringify(previous.mentioned_character_names ?? []) !== JSON.stringify(note.mentioned_character_names ?? [])) {
        incrementCounts(nameCounts, note.mentioned_character_names ?? [], 1);
      }
    });

    update.notes = notesToDoc(notes);
    update.character_ids = [...counts.keys()];
    update.character_mention_counts = Object.fromEntries(counts);
    update.mentioned_character_names = [...nameCounts.keys()];
    update.mentioned_character_name_counts = Object.fromEntries(nameCounts);
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
