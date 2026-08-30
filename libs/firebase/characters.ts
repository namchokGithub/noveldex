import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  documentId,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type {
  Character,
  ChapterSummary,
  PaginatedCharacters,
} from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getCharacterRoles } from "./characterRoles";

interface CharacterDoc {
  name: string;
  aliases: string[];
  role_id: string;
  role: string;
  role_name: string;
  profile_image_url: string | null;
  description: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

const ALLOWED_PER_PAGE = [5, 10, 20, 50];

function charactersCol(novelId: string) {
  return collection(db, "novels", novelId, "characters");
}

function characterRef(novelId: string, characterId: string) {
  return doc(db, "novels", novelId, "characters", characterId);
}

async function characterChapters(
  novelId: string,
  characterId: string,
): Promise<{ chapter_count: number; chapters: ChapterSummary[] }> {
  const q = query(
    collectionGroup(db, "chapters"),
    where("novel_id", "==", novelId),
    where("character_ids", "array-contains", characterId),
    orderBy("number", "asc"),
  );
  const snapshot = await getDocs(q);
  const chapters: ChapterSummary[] = snapshot.docs.map((d) => {
    const data = d.data() as {
      volume_id: string;
      number: number;
      title: string;
      read_at: Timestamp | null;
    };
    return {
      id: d.id,
      volume_id: data.volume_id,
      number: data.number,
      title: data.title,
      read_at: data.read_at ? tsToIso(data.read_at) : null,
    };
  });
  return { chapter_count: chapters.length, chapters };
}

async function toCharacter(
  novelId: string,
  id: string,
  data: CharacterDoc,
  hydrate: boolean,
  chapterCount = 0,
): Promise<Character> {
  const base: Character = {
    id,
    novel_id: novelId,
    name: data.name,
    aliases: data.aliases,
    role_id: data.role_id,
    role: data.role,
    role_name: data.role_name,
    profile_image_url: data.profile_image_url,
    description: data.description,
    first_appearance_chapter_id: null,
    chapter_count: chapterCount,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };

  if (!hydrate) return base;

  const { chapter_count, chapters } = await characterChapters(novelId, id);
  return {
    ...base,
    chapter_count,
    chapters,
    first_appearance_chapter_id: chapters[0]?.id ?? null,
  };
}

async function chapterCountsByNovel(novelId: string): Promise<Map<string, number>> {
  const q = query(collectionGroup(db, "chapters"), where("novel_id", "==", novelId));
  const snapshot = await getDocs(q);
  const counts = new Map<string, number>();
  snapshot.docs.forEach((d) => {
    const data = d.data() as { character_ids?: string[] };
    (data.character_ids ?? []).forEach((characterId) => {
      counts.set(characterId, (counts.get(characterId) ?? 0) + 1);
    });
  });
  return counts;
}

async function resolveRole(
  input: { role_id?: string; role?: string },
): Promise<{ role_id: string; role: string; role_name: string }> {
  const roles = await getCharacterRoles();

  if (input.role_id) {
    const match = roles.find((r) => r.id === input.role_id);
    if (!match) throw new Error("Request failed.");
    return { role_id: match.id, role: match.code, role_name: match.name };
  }

  if (input.role) {
    const match = roles.find((r) => r.code === input.role);
    if (!match) throw new Error("Request failed.");
    return { role_id: match.id, role: match.code, role_name: match.name };
  }

  const fallback = roles.find((r) => r.code === "minor") ?? roles[0];
  if (!fallback) throw new Error("Request failed.");
  return { role_id: fallback.id, role: fallback.code, role_name: fallback.name };
}

export interface CharacterCreatePayload {
  name: string;
  role_id?: string;
  role?: string;
  description: string;
  aliases: string[];
  profile_image_url?: string | null;
}

export async function createCharacter(
  novelId: string,
  payload: CharacterCreatePayload,
): Promise<Character> {
  const resolvedRole = await resolveRole(payload);
  const ref = await addDoc(
    charactersCol(novelId),
    withCreateTimestamps({
      name: payload.name,
      aliases: payload.aliases,
      description: payload.description,
      profile_image_url: payload.profile_image_url ?? null,
      ...resolvedRole,
    }),
  );
  const snapshot = await getDoc(ref);
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, false);
}

export interface CharacterUpdatePayload {
  name?: string;
  role_id?: string;
  role?: string;
  description?: string;
  aliases?: string[];
  profile_image_url?: string | null;
}

export async function updateCharacter(
  novelId: string,
  characterId: string,
  payload: CharacterUpdatePayload,
): Promise<Character> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.aliases !== undefined) update.aliases = payload.aliases;
  if (payload.profile_image_url !== undefined) {
    update.profile_image_url = payload.profile_image_url;
  }
  if (payload.role_id !== undefined || payload.role !== undefined) {
    Object.assign(update, await resolveRole(payload));
  }

  const ref = characterRef(novelId, characterId) as DocumentReference<
    CharacterDoc,
    CharacterDoc
  >;
  await updateDoc(ref, withUpdateTimestamp(update));
  const snapshot = await getDoc(ref);
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, true);
}

export async function getCharacter(novelId: string, characterId: string): Promise<Character> {
  const snapshot = await getDoc(characterRef(novelId, characterId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, true);
}

export async function getAllCharacters(novelId: string): Promise<Character[]> {
  const snapshot = await getDocs(query(charactersCol(novelId), orderBy("name")));
  return Promise.all(
    snapshot.docs.map((d) => toCharacter(novelId, d.id, d.data() as CharacterDoc, false)),
  );
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export async function getCharactersByIds(novelId: string, characterIds: string[]): Promise<Character[]> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return [];
  const snapshots = await Promise.all(chunks(ids, 30).map((group) =>
    getDocs(query(charactersCol(novelId), where(documentId(), "in", group))),
  ));
  const characters = await Promise.all(snapshots.flatMap((snapshot) => snapshot.docs).map((snapshot) =>
    toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, false),
  ));
  const byId = new Map<string, Character>();
  characters.forEach((character) => {
    byId.set(character.id, character);
  });
  return ids.map((id) => byId.get(id)).filter((character): character is Character => Boolean(character));
}

export async function getCharactersByNames(novelId: string, names: string[]): Promise<Character[]> {
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0) return [];
  const snapshots = await Promise.all(chunks(uniqueNames, 30).map((group) =>
    getDocs(query(charactersCol(novelId), where("name", "in", group))),
  ));
  return Promise.all(snapshots.flatMap((snapshot) => snapshot.docs).map((snapshot) =>
    toCharacter(novelId, snapshot.id, snapshot.data() as CharacterDoc, false),
  ));
}

export async function getCharacters(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedCharacters> {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const perPage = ALLOWED_PER_PAGE.includes(options?.perPage as number)
    ? (options!.perPage as number)
    : 5;

  const all = await getAllCharacters(novelId);
  const chapterCounts = await chapterCountsByNovel(novelId);
  const withCounts = all.map((character) => ({
    ...character,
    chapter_count: chapterCounts.get(character.id) ?? 0,
  }));
  const totalItems = withCounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const items = withCounts.slice(start, start + perPage);

  return {
    items,
    pagination: { page, per_page: perPage, total_items: totalItems, total_pages: totalPages },
    summary: { total_characters: totalItems },
  };
}

export async function deleteCharacter(novelId: string, characterId: string): Promise<void> {
  await deleteDoc(characterRef(novelId, characterId));
}
