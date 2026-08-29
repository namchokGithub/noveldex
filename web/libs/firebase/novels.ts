import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import type { Novel } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps } from "./helpers";

interface NovelDoc {
  title: string;
  author: string;
  status: Novel["status"];
  description: string;
  cover_url: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

function novelsCol() {
  return collection(db, "novels");
}

function toNovel(id: string, data: NovelDoc): Novel {
  return {
    id,
    title: data.title,
    author: data.author,
    status: data.status,
    description: data.description,
    cover_url: data.cover_url,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

export async function getNovels(): Promise<Novel[]> {
  const snapshot = await getDocs(query(novelsCol(), orderBy("created_at", "desc")));
  return snapshot.docs.map((d) => toNovel(d.id, d.data() as NovelDoc));
}

export async function getNovel(novelId: string): Promise<Novel> {
  const snapshot = await getDoc(doc(db, "novels", novelId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toNovel(snapshot.id, snapshot.data() as NovelDoc);
}

export interface NovelCreatePayload {
  title: string;
  author: string;
  status: Novel["status"];
  description: string;
  cover_url: string;
}

export async function createNovel(payload: NovelCreatePayload): Promise<Novel> {
  const ref = await addDoc(novelsCol(), withCreateTimestamps(payload));
  const snapshot = await getDoc(ref);
  return toNovel(snapshot.id, snapshot.data() as NovelDoc);
}
