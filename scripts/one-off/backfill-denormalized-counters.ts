import { pathToFileURL } from "node:url";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export type VolumeCounterTarget = {
  chapter_count: number;
  read_count: number;
};

export type NovelCounterTarget = VolumeCounterTarget & {
  volume_count: number;
};

export type BackfillMode = "dry-run" | "apply" | "verify";

export type ReconciliationDocument = {
  path: string;
  actual: Record<string, unknown>;
  target: Record<string, number>;
};

type SourceDocument = {
  id: string;
  ref: SourceDocumentReference;
  data(): Record<string, unknown>;
};

type SourceDocumentReference = {
  path: string;
  collection(name: string): SourceCollection;
};

type SourceCollection = {
  get(): Promise<{ docs: SourceDocument[]; size: number }>;
};

type BackfillDatabase = {
  collection(name: string): SourceCollection;
  bulkWriter(): {
    set(
      reference: SourceDocumentReference,
      data: Record<string, number>,
      options: { merge: true },
    ): PromiseLike<unknown>;
    close(): Promise<void>;
  };
};

type SourceVolume = {
  id: string;
  chapter_count?: unknown;
  read_count?: unknown;
};

type SourceChapter = {
  volume_id: string;
  kind?: unknown;
  read_at?: unknown;
};

export function parseOptions(
  values: string[] = process.argv.slice(2),
  environment: Record<string, string | undefined> = process.env,
): { mode: BackfillMode; projectId: string } {
  let mode: BackfillMode | undefined;
  let projectId = environment.FIREBASE_PROJECT_ID;
  let hasProjectArgument = false;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--dry-run" || value === "--apply" || value === "--verify") {
      if (mode !== undefined) {
        throw new Error("Pass exactly one of --dry-run, --apply, or --verify.");
      }
      mode = value.slice(2) as BackfillMode;
      continue;
    }

    if (value === "--project") {
      if (hasProjectArgument) {
        throw new Error("Pass --project <id> at most once.");
      }
      hasProjectArgument = true;
      const projectArgument = values[index + 1];
      if (!projectArgument || projectArgument.startsWith("--")) {
        throw new Error("Pass --project <id> or set FIREBASE_PROJECT_ID.");
      }
      projectId = projectArgument;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}.`);
  }

  if (mode === undefined) {
    throw new Error("Pass exactly one of --dry-run, --apply, or --verify.");
  }
  if (!projectId) {
    throw new Error("Pass --project <id> or set FIREBASE_PROJECT_ID.");
  }

  return { mode, projectId };
}

export function reconcileDocuments(
  documents: ReconciliationDocument[],
  mode: BackfillMode,
  write: (document: ReconciliationDocument) => void,
  report: (message: string) => void = () => undefined,
): number {
  let mismatches = 0;

  for (const document of documents) {
    const differs = Object.entries(document.target).some(
      ([field, expected]) => document.actual[field] !== expected,
    );
    if (!differs) continue;

    mismatches += 1;
    const actual = Object.fromEntries(
      Object.keys(document.target).map((field) => [
        field,
        document.actual[field] === undefined
          ? "<missing>"
          : document.actual[field],
      ]),
    );
    report(
      `${document.path}: expected ${JSON.stringify(document.target)}; actual ${JSON.stringify(actual)}`,
    );
    if (mode === "apply") write(document);
  }

  return mismatches;
}

export async function backfillDatabase(
  database: BackfillDatabase,
  mode: BackfillMode,
  report: (message: string) => void = console.log,
): Promise<{
  scanned: { novels: number; volumes: number; chapters: number };
  mismatches: number;
  writes: number;
}> {
  const novelSnapshots = await database.collection("novels").get();
  const documents: Array<
    ReconciliationDocument & { reference: SourceDocumentReference }
  > = [];
  let volumeCount = 0;
  let chapterCount = 0;

  for (const novel of novelSnapshots.docs) {
    const volumeSnapshots = await novel.ref.collection("volumes").get();
    volumeCount += volumeSnapshots.size;
    const sourceVolumes: SourceVolume[] = [];
    const sourceChapters: SourceChapter[] = [];

    for (const volume of volumeSnapshots.docs) {
      const volumeData = volume.data();
      sourceVolumes.push({ ...volumeData, id: volume.id });
      const chapterSnapshots = await volume.ref.collection("chapters").get();
      chapterCount += chapterSnapshots.size;
      sourceChapters.push(
        ...chapterSnapshots.docs.map((chapter) => ({
          ...chapter.data(),
          volume_id: volume.id,
        })),
      );
    }

    const targets = counterTargets(sourceVolumes, sourceChapters);
    documents.push({
      path: novel.ref.path,
      reference: novel.ref,
      actual: novel.data(),
      target: { ...targets.novel, counter_schema_version: 1 },
    });
    for (const volume of volumeSnapshots.docs) {
      documents.push({
        path: volume.ref.path,
        reference: volume.ref,
        actual: volume.data(),
        target: {
          ...targets.volumes[volume.id],
          counter_schema_version: 1,
        },
      });
    }
  }

  const scanned = {
    novels: novelSnapshots.size,
    volumes: volumeCount,
    chapters: chapterCount,
  };
  report(
    `Scanned ${scanned.novels} novels, ${scanned.volumes} volumes, and ${scanned.chapters} chapters.`,
  );

  let writes = 0;
  if (mode !== "apply") {
    const mismatches = reconcileDocuments(
      documents,
      mode,
      () => undefined,
      report,
    );
    return { scanned, mismatches, writes };
  }

  const writer = database.bulkWriter();
  const writePromises: Array<Promise<unknown>> = [];
  let mismatches = 0;
  try {
    mismatches = reconcileDocuments(
      documents,
      mode,
      (document) => {
        const source = document as ReconciliationDocument & {
          reference: SourceDocumentReference;
        };
        writePromises.push(
          Promise.resolve(
            writer.set(source.reference, source.target, { merge: true }),
          ),
        );
        writes += 1;
      },
      report,
    );
    await Promise.all(writePromises);
  } finally {
    await writer.close();
  }

  return { scanned, mismatches, writes };
}

export function counterTargets(
  volumes: SourceVolume[],
  chapters: SourceChapter[],
): {
  novel: NovelCounterTarget;
  volumes: Record<string, VolumeCounterTarget>;
} {
  const volumeTargets = Object.fromEntries(
    volumes.map((volume) => [volume.id, { chapter_count: 0, read_count: 0 }]),
  ) as Record<string, VolumeCounterTarget>;

  for (const chapter of chapters) {
    if (chapter.kind !== "chapter") continue;
    const target = volumeTargets[chapter.volume_id];
    if (!target) continue;
    target.chapter_count += 1;
    if (chapter.read_at != null) target.read_count += 1;
  }

  const novel = Object.values(volumeTargets).reduce<NovelCounterTarget>(
    (target, volume) => ({
      volume_count: target.volume_count,
      chapter_count: target.chapter_count + volume.chapter_count,
      read_count: target.read_count + volume.read_count,
    }),
    { volume_count: volumes.length, chapter_count: 0, read_count: 0 },
  );

  return { novel, volumes: volumeTargets };
}

async function main(): Promise<void> {
  const { mode, projectId } = parseOptions();
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  const result = await backfillDatabase(
    getFirestore() as unknown as BackfillDatabase,
    mode,
  );
  console.log(
    `${mode}: ${result.mismatches} mismatches; ${result.writes} writes.`,
  );
  if (mode === "verify" && result.mismatches > 0) process.exitCode = 1;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
