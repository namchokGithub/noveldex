import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./app";

export interface LastOrderNos {
  volume: number;
  chapter: number;
}

export async function getLastOrderNos(params: {
  novel_id?: string;
  volume_id?: string;
}): Promise<LastOrderNos> {
  let volume = 0;
  if (params.novel_id) {
    const snapshot = await getDocs(
      query(
        collection(db, "novels", params.novel_id, "volumes"),
        orderBy("number", "desc"),
        limit(1),
      ),
    );
    volume = snapshot.empty ? 0 : (snapshot.docs[0].data() as { number: number }).number;
  }

  let chapter = 0;
  if (params.volume_id) {
    const snapshot = await getDocs(
      query(
        collectionGroup(db, "chapters"),
        where("volume_id", "==", params.volume_id),
        orderBy("number", "desc"),
        limit(1),
      ),
    );
    chapter = snapshot.empty ? 0 : (snapshot.docs[0].data() as { number: number }).number;
  }

  return { volume, chapter };
}
