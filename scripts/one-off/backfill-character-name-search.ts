import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function parseOptions(values = process.argv.slice(2)) {
  const apply = values.includes("--apply");
  const projectIndex = values.indexOf("--project");
  const projectId = projectIndex >= 0 ? values[projectIndex + 1] : undefined;
  if (projectIndex >= 0 && !projectId) {
    throw new Error("Pass --project <id> after --project.");
  }
  return { apply, projectId };
}

async function main() {
  const { apply, projectId } = parseOptions();
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
  const database = getFirestore(app);
  const snapshot = await database.collectionGroup("characters").get();
  const writer = database.bulkWriter();
  let candidates = 0;
  let writes = 0;

  for (const character of snapshot.docs) {
    const name = character.data().name;
    if (typeof name !== "string") continue;
    const nameSearch = name.trim().toLocaleLowerCase();
    if (character.data().name_search === nameSearch) continue;
    candidates += 1;
    console.log(`${character.ref.path}: name_search → ${JSON.stringify(nameSearch)}`);
    if (apply) {
      writer.update(character.ref, { name_search: nameSearch });
      writes += 1;
    }
  }

  if (apply) {
    await writer.flush();
    await writer.close();
  }
  console.log(
    `${apply ? "apply" : "dry-run"}: ${candidates} candidates; ${writes} writes.`,
  );
}

void main();
