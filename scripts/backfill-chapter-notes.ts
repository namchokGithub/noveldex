import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type LegacyChapter = {
  summary?: string;
  notes?: unknown;
  created_at?: Timestamp;
  updated_at?: Timestamp;
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
  const chapters = await db.collectionGroup("chapters").get();
  const writer = dryRun ? null : db.bulkWriter();
  let migrated = 0;
  let withSummary = 0;
  let alreadyMigrated = 0;

  for (const snapshot of chapters.docs) {
    const data = snapshot.data() as LegacyChapter;
    // An existing empty array is already migrated; never overwrite user notes.
    if (Array.isArray(data.notes)) {
      alreadyMigrated += 1;
      continue;
    }
    const content = data.summary?.trim() ?? "";
    const createdAt = data.created_at ?? Timestamp.now();
    const updatedAt = data.updated_at ?? createdAt;
    const notes = content
      ? [{ id: `legacy-${snapshot.id}`, content, created_at: createdAt, updated_at: updatedAt }]
      : [];
    migrated += 1;
    if (content) withSummary += 1;
    if (!dryRun) writer!.update(snapshot.ref, { notes });
  }

  if (writer) await writer.close();
  console.log(`${dryRun ? "Dry run" : "Applied"}: ${migrated}/${chapters.size} chapter documents need notes (${withSummary} legacy summaries, ${alreadyMigrated} already migrated).`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
