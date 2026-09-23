import { pathToFileURL } from "node:url";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { parseOptions, type BackfillMode } from "./backfill-denormalized-counters";

type SourceType = "chapter_note" | "event" | "adaptation_note";
type Occurrence = {
  token?: {
    status?: unknown;
    reference?: { entityId?: unknown };
  };
};

type IndexEntry = {
  id: string;
  entity_id: string;
  source_type: SourceType;
  source_id: string;
  source_key: string;
  note_id?: string;
  volume_id?: string;
  title: string;
  preview: string;
  sort_order: number;
  updated_at: string;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (
    value !== null &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function referenceId(
  sourceType: SourceType,
  sourceId: string,
  noteId: string | undefined,
  entityId: string,
) {
  return [
    sourceType,
    encodeURIComponent(sourceId),
    noteId ? encodeURIComponent(noteId) : "-",
    encodeURIComponent(entityId),
  ].join("_");
}

function entityIds(references: unknown): string[] {
  if (!Array.isArray(references)) return [];
  return [
    ...new Set(
      references.flatMap((value) => {
        const occurrence = value as Occurrence;
        const entityId = occurrence.token?.reference?.entityId;
        return occurrence.token?.status === "resolved" && typeof entityId === "string"
          ? [entityId]
          : [];
      }),
    ),
  ];
}

function noteEntries({
  sourceType,
  sourceId,
  volumeId,
  title,
  sortOrder,
  updatedAt,
  notes,
}: {
  sourceType: "chapter_note" | "adaptation_note";
  sourceId: string;
  volumeId: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
  notes: unknown;
}): IndexEntry[] {
  if (!Array.isArray(notes)) return [];
  return notes.flatMap((value) => {
    const note = value as { id?: unknown; content?: unknown; references?: unknown };
    if (typeof note.id !== "string" || typeof note.content !== "string") return [];
    const noteId = note.id;
    const preview = note.content;
    return entityIds(note.references).map((entityId) => ({
      id: referenceId(sourceType, sourceId, noteId, entityId),
      entity_id: entityId,
      source_type: sourceType,
      source_id: sourceId,
      source_key: `${sourceType}:${encodeURIComponent(sourceId)}`,
      note_id: noteId,
      volume_id: volumeId,
      title,
      preview,
      sort_order: sortOrder,
      updated_at: updatedAt,
    }));
  });
}

export function indexEntriesForNovel(
  novelId: string,
  sources: {
    chapters: Array<{ id: string; volumeId: string; data: Record<string, unknown> }>;
    events: Array<{ id: string; data: Record<string, unknown> }>;
    adaptations: Array<{ id: string; volumeId: string; data: Record<string, unknown> }>;
  },
): IndexEntry[] {
  const chapters = sources.chapters.flatMap(({ id, volumeId, data }) =>
    noteEntries({
      sourceType: "chapter_note",
      sourceId: id,
      volumeId,
      title: String(data.title_en ?? data.title ?? ""),
      sortOrder: Number(data.sort_order ?? data.number ?? 0),
      updatedAt: iso(data.updated_at),
      notes: data.notes,
    }),
  );
  const events = sources.events.flatMap(({ id, data }) =>
    entityIds(data.description_references).map((entityId) => ({
      id: referenceId("event", id, undefined, entityId),
      entity_id: entityId,
      source_type: "event" as const,
      source_id: id,
      source_key: `event:${encodeURIComponent(id)}`,
      title: String(data.title ?? ""),
      preview: String(data.title ?? ""),
      sort_order: Number(data.sort_order ?? 0),
      updated_at: iso(data.updated_at),
    })),
  );
  const adaptations = sources.adaptations.flatMap(({ id, volumeId, data }) =>
    noteEntries({
      sourceType: "adaptation_note",
      sourceId: id,
      volumeId,
      title: String(data.title ?? ""),
      sortOrder: Number(data.sort_order ?? 0),
      updatedAt: iso(data.updated_at),
      notes: data.notes,
    }),
  );
  void novelId;
  return [...chapters, ...events, ...adaptations];
}

function sameEntry(actual: Record<string, unknown>, target: IndexEntry) {
  return Object.entries(target).every(([key, value]) => actual[key] === value);
}

async function backfill(mode: BackfillMode, projectId: string) {
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  const novels = await db.collection("novels").get();
  const writer = mode === "apply" ? db.bulkWriter() : null;
  let creates = 0, updates = 0, deletes = 0, sources = 0;

  for (const novel of novels.docs) {
    const volumes = await novel.ref.collection("volumes").get();
    const chapters: Array<{ id: string; volumeId: string; data: Record<string, unknown> }> = [];
    const adaptations: Array<{ id: string; volumeId: string; data: Record<string, unknown> }> = [];
    for (const volume of volumes.docs) {
      const [chapterDocs, adaptationDocs] = await Promise.all([
        volume.ref.collection("chapters").get(),
        volume.ref.collection("adaptations").get(),
      ]);
      chapters.push(...chapterDocs.docs.map((item) => ({ id: item.id, volumeId: volume.id, data: item.data() })));
      adaptations.push(...adaptationDocs.docs.map((item) => ({ id: item.id, volumeId: volume.id, data: item.data() })));
    }
    const eventDocs = await novel.ref.collection("events").get();
    const targets = indexEntriesForNovel(novel.id, { chapters, adaptations, events: eventDocs.docs.map((item) => ({ id: item.id, data: item.data() })) });
    sources += chapters.length + adaptations.length + eventDocs.size;
    const existing = await novel.ref.collection("entityReferences").get();
    const targetById = new Map(targets.map((item) => [item.id, item]));
    for (const document of existing.docs) {
      const target = targetById.get(document.id);
      if (!target) {
        deletes += 1;
        if (writer) writer.delete(document.ref);
      } else if (!sameEntry(document.data(), target)) {
        updates += 1;
        if (writer) writer.set(document.ref, target);
      }
      targetById.delete(document.id);
    }
    for (const target of targetById.values()) {
      creates += 1;
      if (writer) writer.create(novel.ref.collection("entityReferences").doc(target.id), target);
    }
  }
  if (writer) { await writer.flush(); await writer.close(); }
  const drift = creates + updates + deletes;
  console.log(`${mode}: ${sources} sources; ${creates} creates; ${updates} updates; ${deletes} deletes.`);
  if (mode === "verify" && drift > 0) process.exitCode = 1;
}

async function main() {
  const { mode, projectId } = parseOptions();
  await backfill(mode, projectId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
