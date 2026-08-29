import { addDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import type { Tag } from "@/app/types";
import { db } from "./app";

interface TagDoc {
  name: string;
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

export async function createTag(novelId: string, name: string): Promise<Tag> {
  const ref = await addDoc(tagsCol(novelId), { name });
  return toTag(novelId, ref.id, { name });
}
