import {
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore/lite";
import type { Tag } from "@/app/types";
import { db } from "./app";

interface TagDoc {
  name: string;
}

export const TAG_NAME_MAX_LENGTH = 50;

export type TagCursor = QueryDocumentSnapshot<DocumentData>;

export interface TagPage {
  tags: Tag[];
  cursor: TagCursor | null;
  hasMore: boolean;
}

function tagsCol(novelId: string) {
  return collection(db, "novels", novelId, "tags");
}

function toTag(novelId: string, id: string, data: TagDoc): Tag {
  return { id, novel_id: novelId, name: data.name };
}

export async function getTags(novelId: string): Promise<Tag[]> {
  const snapshot = await getDocs(query(tagsCol(novelId), orderBy("name")));
  return snapshot.docs.map((d) => toTag(novelId, d.id, d.data() as TagDoc));
}

export async function getTagsPage(
  novelId: string,
  cursor: TagCursor | null,
  pageSize = 10,
): Promise<TagPage> {
  const pageLimit = limit(pageSize + 1);
  const tagQuery = cursor
    ? query(tagsCol(novelId), orderBy("name"), startAfter(cursor), pageLimit)
    : query(tagsCol(novelId), orderBy("name"), pageLimit);
  const snapshot = await getDocs(tagQuery);
  const pageDocs = snapshot.docs.slice(0, pageSize);

  return {
    tags: pageDocs.map((tag) => toTag(novelId, tag.id, tag.data() as TagDoc)),
    cursor: pageDocs.at(-1) ?? cursor,
    hasMore: snapshot.docs.length > pageSize,
  };
}

export async function createTag(novelId: string, name: string): Promise<Tag> {
  if (name.trim().length > TAG_NAME_MAX_LENGTH) {
    throw new Error(
      `Tag names cannot exceed ${TAG_NAME_MAX_LENGTH} characters.`,
    );
  }

  const ref = await addDoc(tagsCol(novelId), { name });
  return toTag(novelId, ref.id, { name });
}
