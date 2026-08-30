import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type EventData = {
  chapter_id?: string | null;
  chapter_volume_id?: string | null;
  chapter_title?: string | null;
  chapter_number?: number | null;
  page_number?: number | null;
};

function options() {
  const values = process.argv.slice(2);
  const projectAt = values.indexOf("--project");
  const projectId = projectAt >= 0 ? values[projectAt + 1] : process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Pass --project <id> or set FIREBASE_PROJECT_ID.");
  const dryRun = values.includes("--dry-run");
  const apply = values.includes("--apply");
  if (dryRun === apply) throw new Error("Pass exactly one of --dry-run or --apply.");
  return { dryRun, projectId };
}

async function main() {
  const { dryRun, projectId } = options();
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const events = await db.collectionGroup("events").get();
  const writer = dryRun ? null : db.bulkWriter();
  let updated = 0;
  let unplaced = 0;
  let unresolved = 0;

  for (const snapshot of events.docs) {
    const data = snapshot.data() as EventData;
    const novelId = snapshot.ref.parent.parent?.id;
    const update: Record<string, unknown> = {};
    if (data.page_number === undefined) update.page_number = null;
    if (!data.chapter_id) {
      unplaced += 1;
    } else if (!novelId || !data.chapter_volume_id) {
      unresolved += 1;
      console.warn(`Cannot resolve location for event ${snapshot.id}: missing novel or volume id.`);
    } else {
      const chapter = await db.doc(`novels/${novelId}/volumes/${data.chapter_volume_id}/chapters/${data.chapter_id}`).get();
      if (!chapter.exists) {
        unresolved += 1;
        console.warn(`Cannot resolve location for event ${snapshot.id}: chapter does not exist.`);
      } else {
        const chapterData = chapter.data() as { title?: string; number?: number };
        if (data.chapter_title !== chapterData.title) update.chapter_title = chapterData.title ?? null;
        if (data.chapter_number !== chapterData.number) update.chapter_number = chapterData.number ?? null;
      }
    }
    if (Object.keys(update).length > 0) {
      updated += 1;
      if (!dryRun) writer!.update(snapshot.ref, update);
    }
  }

  if (writer) await writer.close();
  console.log(`${dryRun ? "Dry run" : "Applied"}: ${updated}/${events.size} event documents need location updates; ${unplaced} unplaced; ${unresolved} unresolved.`);
  if (unresolved > 0) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
