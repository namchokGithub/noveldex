import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BATCH_SIZE = 450;

function options() {
  const values = process.argv.slice(2);
  const projectAt = values.indexOf("--project");
  const projectId =
    projectAt >= 0
      ? values[projectAt + 1]
      : (process.env.FIREBASE_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  if (!projectId)
    throw new Error("Pass --project <id> or set FIREBASE_PROJECT_ID.");
  return { apply: values.includes("--apply"), projectId };
}

async function main() {
  const { apply, projectId } = options();
  if (getApps().length === 0)
    initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const chapters = await db.collectionGroup("chapters").get();
  const markerTargets = new Map<
    string,
    { chapterId: string; novelId: string; volumeId: string; number: number }
  >();

  for (const chapter of chapters.docs) {
    const data = chapter.data() as {
      novel_id?: string;
      volume_id?: string;
      number?: number | null;
    };
    if (data.number === null || data.number === undefined) continue;
    if (
      !Number.isInteger(data.number) ||
      data.number < 1 ||
      !data.novel_id ||
      !data.volume_id
    ) {
      throw new Error(`Invalid numbered chapter: ${chapter.ref.path}`);
    }
    const key = `${data.novel_id}/${data.volume_id}/${data.number}`;
    const existing = markerTargets.get(key);
    if (existing && existing.chapterId !== chapter.id) {
      throw new Error(
        `Duplicate chapter number ${data.number} in volume ${data.volume_id}.`,
      );
    }
    markerTargets.set(key, {
      chapterId: chapter.id,
      novelId: data.novel_id,
      volumeId: data.volume_id,
      number: data.number,
    });
  }

  const novelIds = [
    ...new Set([...markerTargets.values()].map((target) => target.novelId)),
  ];
  const legacyMarkers = (
    await Promise.all(
      novelIds.map((novelId) =>
        db.collection("novels").doc(novelId).collection("chapterNumbers").get(),
      ),
    )
  ).flatMap((snapshot) => snapshot.docs);

  console.log(
    `${apply ? "Applying" : "Dry run"}: ${markerTargets.size} volume-scoped markers; ${legacyMarkers.length} legacy novel-scoped markers to delete.`,
  );
  if (!apply) return;

  const writes = [
    ...[...markerTargets.values()].map((target) => ({
      type: "set" as const,
      ref: db
        .collection("novels")
        .doc(target.novelId)
        .collection("volumes")
        .doc(target.volumeId)
        .collection("chapterNumbers")
        .doc(String(target.number)),
      data: { chapter_id: target.chapterId },
    })),
    ...legacyMarkers.map((marker) => ({
      type: "delete" as const,
      ref: marker.ref,
    })),
  ];

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_SIZE).forEach((write) => {
      if (write.type === "set") batch.set(write.ref, write.data);
      else batch.delete(write.ref);
    });
    await batch.commit();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
