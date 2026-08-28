import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Pool } from "pg";

type Args = { dryRun: boolean; verifyOnly: boolean; confirm: boolean; projectId: string };
type Row = Record<string, unknown>;

function args(): Args {
  const values = process.argv.slice(2);
  const projectAt = values.indexOf("--project");
  const projectId = projectAt >= 0 ? values[projectAt + 1] : process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Pass --project <id> or set FIREBASE_PROJECT_ID.");
  return { dryRun: values.includes("--dry-run"), verifyOnly: values.includes("--verify-only"), confirm: values.includes("--confirm"), projectId };
}

function date(value: unknown): Timestamp {
  if (!(value instanceof Date)) throw new Error("Expected PostgreSQL timestamp.");
  return Timestamp.fromDate(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function rows(pool: Pool, sql: string): Promise<Row[]> {
  return (await pool.query(sql)).rows;
}

async function main() {
  const options = args();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!options.dryRun && !options.verifyOnly && !options.confirm) {
    throw new Error("Refusing to write: pass --confirm after a successful --dry-run.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const [novels, roles, volumes, chapters, characters, events, tags, chapterCharacters, chapterTags, eventCharacters] = await Promise.all([
    rows(pool, "SELECT id::text, title, author, status, description, cover_url, created_at, updated_at FROM novels"),
    rows(pool, "SELECT id::text, code, name, is_active FROM character_roles"),
    rows(pool, "SELECT id::text, novel_id::text, number, title, created_at, updated_at FROM volumes"),
    rows(pool, "SELECT c.id::text, v.novel_id::text, c.volume_id::text, c.number, c.title, c.summary, c.read_at, c.created_at, c.updated_at FROM chapters c JOIN volumes v ON v.id = c.volume_id"),
    rows(pool, "SELECT c.id::text, c.novel_id::text, c.name, c.aliases, c.role_id::text, r.code AS role, r.name AS role_name, c.profile_image_url, c.description, c.created_at, c.updated_at FROM characters c JOIN character_roles r ON r.id = c.role_id"),
    rows(pool, "SELECT e.id::text, e.novel_id::text, e.chapter_id::text, e.title, e.description, e.story_date, e.sort_order, e.created_at, e.updated_at, c.volume_id::text AS chapter_volume_id, c.title AS chapter_title, c.number AS chapter_number FROM events e LEFT JOIN chapters c ON c.id = e.chapter_id"),
    rows(pool, "SELECT id::text, novel_id::text, name FROM tags"),
    rows(pool, "SELECT chapter_id::text, array_agg(character_id::text) AS ids FROM chapter_characters GROUP BY chapter_id"),
    rows(pool, "SELECT chapter_id::text, array_agg(tag_id::text) AS ids FROM chapter_tags GROUP BY chapter_id"),
    rows(pool, "SELECT event_id::text, array_agg(character_id::text) AS ids FROM event_characters GROUP BY event_id"),
  ]);
  await pool.end();

  const chapterCharacterIds = new Map(chapterCharacters.map((r) => [String(r.chapter_id), strings(r.ids)]));
  const chapterTagIds = new Map(chapterTags.map((r) => [String(r.chapter_id), strings(r.ids)]));
  const eventCharacterIds = new Map(eventCharacters.map((r) => [String(r.event_id), strings(r.ids)]));
  for (const event of events) {
    if (event.chapter_id && (!event.chapter_volume_id || event.chapter_title === null || event.chapter_number === null)) {
      throw new Error(`Event ${event.id} has an unresolved chapter_id; refusing incomplete chapter_volume_id backfill.`);
    }
  }

  const counts = { novels: novels.length, roles: roles.length, volumes: volumes.length, chapters: chapters.length, characters: characters.length, events: events.length, tags: tags.length };
  console.log("PostgreSQL source counts:", counts);
  if (options.dryRun) return;

  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: options.projectId });
  const db = getFirestore();
  if (options.verifyOnly) {
    const [roleDocs, novelDocs] = await Promise.all([db.collection("character_roles").count().get(), db.collection("novels").count().get()]);
    console.log("Firestore destination counts:", { roles: roleDocs.data().count, novels: novelDocs.data().count });
    if (roleDocs.data().count !== counts.roles || novelDocs.data().count !== counts.novels) throw new Error("Firestore verification failed.");
    return;
  }

  const writer = db.bulkWriter();
  roles.forEach((r) => writer.set(db.collection("character_roles").doc(String(r.id)), { code: r.code, name: r.name, is_active: r.is_active }));
  novels.forEach((r) => writer.set(db.collection("novels").doc(String(r.id)), { title: r.title, author: r.author ?? "", status: r.status, description: r.description ?? "", cover_url: r.cover_url ?? "", created_at: date(r.created_at), updated_at: date(r.updated_at) }));
  volumes.forEach((r) => writer.set(db.collection("novels").doc(String(r.novel_id)).collection("volumes").doc(String(r.id)), { number: r.number, title: r.title, created_at: date(r.created_at), updated_at: date(r.updated_at) }));
  tags.forEach((r) => writer.set(db.collection("novels").doc(String(r.novel_id)).collection("tags").doc(String(r.id)), { name: r.name }));
  characters.forEach((r) => writer.set(db.collection("novels").doc(String(r.novel_id)).collection("characters").doc(String(r.id)), { name: r.name, aliases: strings(r.aliases), role_id: r.role_id, role: r.role, role_name: r.role_name, profile_image_url: r.profile_image_url ?? null, description: r.description ?? "", created_at: date(r.created_at), updated_at: date(r.updated_at) }));
  chapters.forEach((r) => {
    const novel = db.collection("novels").doc(String(r.novel_id));
    writer.set(novel.collection("volumes").doc(String(r.volume_id)).collection("chapters").doc(String(r.id)), { number: r.number, title: r.title, summary: r.summary ?? "", read_at: r.read_at ? date(r.read_at) : null, novel_id: r.novel_id, volume_id: r.volume_id, tag_ids: chapterTagIds.get(String(r.id)) ?? [], character_ids: chapterCharacterIds.get(String(r.id)) ?? [], created_at: date(r.created_at), updated_at: date(r.updated_at) });
    writer.set(novel.collection("chapterNumbers").doc(String(r.number)), { chapter_id: r.id });
  });
  events.forEach((r) => writer.set(db.collection("novels").doc(String(r.novel_id)).collection("events").doc(String(r.id)), { title: r.title, description: r.description ?? "", story_date: r.story_date, sort_order: r.sort_order, chapter_id: r.chapter_id ?? null, chapter_volume_id: r.chapter_volume_id ?? null, chapter_title: r.chapter_title ?? null, chapter_number: r.chapter_number ?? null, character_ids: eventCharacterIds.get(String(r.id)) ?? [], created_at: date(r.created_at), updated_at: date(r.updated_at) }));
  await writer.close();
  console.log("Firestore migration completed. Run --verify-only before cutover.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
