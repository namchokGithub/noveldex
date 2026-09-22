import {
  collection,
  collectionGroup,
  documentId,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore/lite";
import type {
  Character,
  CharacterCursor,
  CharacterPage,
  ChapterKind,
  ChapterSummary,
  PaginatedCharacters,
} from "@/app/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { db } from "./app";
import { tsToIso, withCreateTimestamps, withUpdateTimestamp } from "./helpers";
import { getCharacterRoles } from "./characterRoles";
import { getNovel } from "./novels";
import { relatedNotesForCharacter } from "@/libs/characterRelatedNotes";

interface CharacterDoc {
  name: string;
  aliases: string[];
  role_id: string;
  role: string;
  role_name: string;
  profile_image_url: string | null;
  description: string;
  chapter_count?: number;
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
      number: number | null;
      sort_order?: number;
      kind?: ChapterKind;
      custom_label?: string | null;
      title?: string;
      title_en?: string;
      title_th?: string;
      notes?: Array<{
        id: string;
        content: string;
        character_ids?: string[];
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      read_at: Timestamp | null;
    };
    const notesById = new Map(
      (data.notes ?? []).map((note) => [note.id, note]),
    );
    return {
      id: d.id,
      volume_id: data.volume_id,
      number: data.number,
      sort_order: data.sort_order ?? data.number ?? 0,
      kind: data.kind ?? "chapter",
      custom_label: data.custom_label ?? null,
      title: data.title_en ?? data.title ?? "",
      title_en: data.title_en ?? data.title ?? "",
      title_th: data.title_th ?? "",
      notes: relatedNotesForCharacter(
        [{ id: d.id, notes: data.notes ?? [] }],
        characterId,
      ).flatMap(({ note }) => {
        const source = notesById.get(note.id);
        return source
          ? [
              {
                ...note,
                created_at: tsToIso(source.created_at),
                updated_at: tsToIso(source.updated_at),
              },
            ]
          : [];
      }),
      read_at: data.read_at ? tsToIso(data.read_at) : null,
    };
  });
  chapters.sort((a, b) => a.sort_order - b.sort_order);
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
    chapter_count: hydrate
      ? chapterCount
      : (data.chapter_count ?? chapterCount),
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

async function resolveRole(input: {
  role_id?: string;
  role?: string;
}): Promise<{ role_id: string; role: string; role_name: string }> {
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
  return {
    role_id: fallback.id,
    role: fallback.code,
    role_name: fallback.name,
  };
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
  const ref = doc(charactersCol(novelId));
  await runTransaction(db, async (transaction) => {
    const novelRef = doc(db, "novels", novelId);
    const novelSnapshot = await transaction.get(novelRef);
    if (!novelSnapshot.exists()) throw new ResourceNotFoundError("novel");
    const currentCount = novelSnapshot.data()?.character_count;
    transaction.set(
      ref,
      withCreateTimestamps({
        name: payload.name,
        aliases: payload.aliases,
        description: payload.description,
        profile_image_url: payload.profile_image_url ?? null,
        chapter_count: 0,
        ...resolvedRole,
      }),
    );
    transaction.update(novelRef, {
      character_count:
        (typeof currentCount === "number" && Number.isFinite(currentCount)
          ? currentCount
          : 0) + 1,
    });
  });
  const snapshot = await getDoc(ref);
  return toCharacter(
    novelId,
    snapshot.id,
    snapshot.data() as CharacterDoc,
    false,
  );
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
  if (payload.description !== undefined)
    update.description = payload.description;
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
  return toCharacter(
    novelId,
    snapshot.id,
    snapshot.data() as CharacterDoc,
    true,
  );
}

export async function getCharacter(
  novelId: string,
  characterId: string,
): Promise<Character> {
  const snapshot = await getDoc(characterRef(novelId, characterId));
  if (!snapshot.exists()) {
    throw new ResourceNotFoundError("character");
  }
  return toCharacter(
    novelId,
    snapshot.id,
    snapshot.data() as CharacterDoc,
    true,
  );
}

export async function getAllCharacters(novelId: string): Promise<Character[]> {
  const snapshot = await getDocs(
    query(charactersCol(novelId), orderBy("name")),
  );
  return Promise.all(
    snapshot.docs.map((d) =>
      toCharacter(novelId, d.id, d.data() as CharacterDoc, false),
    ),
  );
}

export function encodeCharacterCursor(cursor: CharacterCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeCharacterCursor(value: string): CharacterCursor | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const cursor = parsed as Partial<CharacterCursor>;
    if (
      typeof cursor.name !== "string" ||
      cursor.name.length === 0 ||
      typeof cursor.id !== "string" ||
      cursor.id.length === 0 ||
      cursor.id.includes("/")
    ) {
      return null;
    }
    return { name: cursor.name, id: cursor.id };
  } catch {
    return null;
  }
}

export function resolveCharacterCursorSearch({
  after,
  before,
}: {
  after?: string;
  before?: string;
}): { after: CharacterCursor | null; before: CharacterCursor | null } {
  const decodedAfter = decodeCharacterCursor(after ?? "");
  const decodedBefore = decodeCharacterCursor(before ?? "");
  const hasInvalidCursor =
    (after !== undefined && !decodedAfter) ||
    (before !== undefined && !decodedBefore) ||
    (decodedAfter !== null && decodedBefore !== null);

  return hasInvalidCursor
    ? { after: null, before: null }
    : { after: decodedAfter, before: decodedBefore };
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export async function getCharactersByIds(
  novelId: string,
  characterIds: string[],
): Promise<Character[]> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return [];
  const snapshots = await Promise.all(
    chunks(ids, 30).map((group) =>
      getDocs(query(charactersCol(novelId), where(documentId(), "in", group))),
    ),
  );
  const characters = await Promise.all(
    snapshots
      .flatMap((snapshot) => snapshot.docs)
      .map((snapshot) =>
        toCharacter(
          novelId,
          snapshot.id,
          snapshot.data() as CharacterDoc,
          false,
        ),
      ),
  );
  const byId = new Map<string, Character>();
  characters.forEach((character) => {
    byId.set(character.id, character);
  });
  return ids
    .map((id) => byId.get(id))
    .filter((character): character is Character => Boolean(character));
}

export async function getCharactersByNames(
  novelId: string,
  names: string[],
): Promise<Character[]> {
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0) return [];
  const snapshots = await Promise.all(
    chunks(uniqueNames, 30).map((group) =>
      getDocs(query(charactersCol(novelId), where("name", "in", group))),
    ),
  );
  return Promise.all(
    snapshots
      .flatMap((snapshot) => snapshot.docs)
      .map((snapshot) =>
        toCharacter(
          novelId,
          snapshot.id,
          snapshot.data() as CharacterDoc,
          false,
        ),
      ),
  );
}

export async function getCharacters(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedCharacters> {
  const page = await getCharactersPage(novelId, options);
  return {
    items: page.items,
    pagination: page.pagination,
    summary: { total_characters: page.pagination.total_items },
  };
}

export async function getCharactersPage(
  novelId: string,
  options?: {
    page?: number;
    perPage?: number;
    after?: CharacterCursor | null;
    before?: CharacterCursor | null;
  },
): Promise<CharacterPage> {
  const after = options?.after ?? null;
  const before = options?.before ?? null;
  const page =
    (after || before) &&
    Number.isInteger(options?.page) &&
    (options?.page ?? 0) > 0
      ? (options?.page as number)
      : 1;
  const perPage =
    Number.isInteger(options?.perPage) &&
    ALLOWED_PER_PAGE.includes(options?.perPage as number)
      ? (options?.perPage as number)
      : 5;
  const charactersQuery = before
    ? query(
        charactersCol(novelId),
        orderBy("name", "desc"),
        orderBy(documentId(), "desc"),
        startAfter(before.name, before.id),
        limit(perPage),
      )
    : after
      ? query(
          charactersCol(novelId),
          orderBy("name", "asc"),
          orderBy(documentId(), "asc"),
          startAfter(after.name, after.id),
          limit(perPage),
        )
      : query(
          charactersCol(novelId),
          orderBy("name", "asc"),
          orderBy(documentId(), "asc"),
          limit(perPage),
        );
  const [novel, snapshot] = await Promise.all([
    getNovel(novelId),
    getDocs(charactersQuery),
  ]);
  const pageDocs = before ? [...snapshot.docs].reverse() : snapshot.docs;
  const items = await Promise.all(
    pageDocs.map((d) =>
      toCharacter(novelId, d.id, d.data() as CharacterDoc, false),
    ),
  );
  const totalItems = novel.character_count;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const first = pageDocs[0];
  const last = pageDocs.at(-1);
  const cursorFor = (document: (typeof pageDocs)[number]): CharacterCursor => ({
    name: (document.data() as CharacterDoc).name,
    id: document.id,
  });

  return {
    novel,
    items,
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: totalPages,
    },
    previousCursor: page > 1 && first ? cursorFor(first) : null,
    nextCursor: page < totalPages && last ? cursorFor(last) : null,
  };
}

export async function deleteCharacter(
  novelId: string,
  characterId: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const character = characterRef(novelId, characterId);
    const novel = doc(db, "novels", novelId);
    const characterSnapshot = await transaction.get(character);
    if (!characterSnapshot.exists()) return;
    const novelSnapshot = await transaction.get(novel);
    transaction.delete(character);
    if (novelSnapshot.exists()) {
      const currentCount = novelSnapshot.data()?.character_count;
      transaction.update(novel, {
        character_count: Math.max(
          0,
          (typeof currentCount === "number" && Number.isFinite(currentCount)
            ? currentCount
            : 0) - 1,
        ),
      });
    }
  });
}
