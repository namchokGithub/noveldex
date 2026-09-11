import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function options() {
  const values = process.argv.slice(2);
  const projectAt = values.indexOf("--project");
  const projectId = (projectAt >= 0 ? values[projectAt + 1] : undefined) ?? process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
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
  let current = 0;

  for (const snapshot of chapters.docs) {
    const data = snapshot.data() as { number?: number | null; sort_order?: number; kind?: string; custom_label?: string | null };
    if (data.sort_order !== undefined && data.kind !== undefined && data.custom_label !== undefined) {
      current += 1;
      continue;
    }
    migrated += 1;
    if (!dryRun) writer!.update(snapshot.ref, {
      sort_order: data.sort_order ?? data.number ?? 0,
      kind: data.kind ?? "chapter",
      custom_label: data.custom_label ?? null,
    });
  }
  if (writer) await writer.close();
  console.log(`${dryRun ? "Dry run" : "Applied"}: ${migrated}/${chapters.size} chapters need entry ordering (${current} already migrated).`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
