import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function options() {
  const values = process.argv.slice(2); const projectIndex = values.indexOf("--project");
  const projectId = projectIndex >= 0 ? values[projectIndex + 1] : process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const dryRun = values.includes("--dry-run"), apply = values.includes("--apply");
  if (!projectId || dryRun === apply) throw new Error("Pass --project <id> and exactly one of --dry-run or --apply.");
  return { projectId, dryRun };
}

function occurrences(novelId: string, content: string, names: Map<string, { id: string; type: string }>) {
  return Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => {
    const inner = match[1].trim(), separator = inner.indexOf(":"), candidateType = separator < 0 ? "character" : inner.slice(0, separator).trim();
    const typed = ["character", "location", "skill", "organization", "item", "concept"].includes(candidateType) ? candidateType : "character";
    const label = (separator >= 0 && typed === candidateType ? inner.slice(separator + 1) : inner).trim();
    const found = names.get(`${typed}:${label.normalize("NFC").toLocaleLowerCase()}`);
    return { start: match.index ?? 0, length: match[0].length, raw: match[0], token: found ? { status: "resolved", reference: { entityId: `${novelId}:${found.type}:${found.id}`, entityType: found.type, label } } : { status: "unresolved", typed: typed === "character" && separator < 0 ? null : typed, label } };
  });
}

async function main() {
  const { projectId, dryRun } = options(); if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(), novels = await db.collection("novels").get(); let updated = 0;
  for (const novel of novels.docs) {
    const names = new Map<string, { id: string; type: string }>();
    for (const collection of ["characters", "entities"] as const) for (const entity of (await novel.ref.collection(collection).get()).docs) {
      const data = entity.data() as { name?: string; aliases?: string[]; type?: string }; const type = collection === "characters" ? "character" : data.type;
      if (!type) continue; for (const name of [data.name, ...(data.aliases ?? [])]) if (name) names.set(`${type}:${name.normalize("NFC").trim().toLocaleLowerCase()}`, { id: entity.id, type });
    }
    for (const volume of await novel.ref.collection("volumes").listDocuments()) for (const chapter of (await volume.collection("chapters").get()).docs) {
      const data = chapter.data() as { notes?: Array<{ content: string; references?: unknown }> }; if (!data.notes?.some((note) => note.references === undefined)) continue;
      const notes = data.notes.map((note) => note.references !== undefined ? note : { ...note, references: occurrences(novel.id, note.content, names) }); updated += 1;
      if (!dryRun) await chapter.ref.update({ notes });
    }
  }
  console.log(`${dryRun ? "Dry run" : "Applied"}: ${updated} chapter documents need entity-reference backfill.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
