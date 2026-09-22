import type { ChapterKind } from "@/app/types";
import {
  doc,
  increment,
  type DocumentData,
  type DocumentReference,
  type FieldValue,
  type Timestamp,
  type Transaction,
} from "firebase/firestore/lite";
import { db } from "./app";

export type ChapterCounter = {
  chapter_count: number;
  read_count: number;
};

export type MaintainedCounterField = "adaptation_count" | "event_count";

export type MaintainedCounterDelta = {
  reference: DocumentReference<DocumentData>;
  field: MaintainedCounterField;
  delta: number;
};

export type CharacterChapterCountDelta = {
  characterId: string;
  delta: number;
};

/**
 * Applies Chapter appearance counts to Character documents that still exist.
 * Legacy chapters can retain references to deleted Characters, so a missing
 * target is intentionally ignored instead of being created or failing the
 * source mutation.
 */
export async function applyCharacterChapterCountDeltas(
  transaction: Transaction,
  novelId: string,
  deltas: CharacterChapterCountDelta[],
): Promise<void> {
  const combined = new Map<string, number>();
  for (const { characterId, delta } of deltas) {
    if (!characterId || delta === 0) continue;
    combined.set(characterId, (combined.get(characterId) ?? 0) + delta);
  }

  const nonZero = [...combined.entries()].filter(([, delta]) => delta !== 0);
  const snapshots = await Promise.all(
    nonZero.map(async ([characterId, delta]) => {
      const reference = doc(db, "novels", novelId, "characters", characterId);
      return {
        characterId,
        delta,
        reference,
        snapshot: await transaction.get(reference),
      };
    }),
  );

  for (const { delta, reference, snapshot } of snapshots) {
    if (!snapshot.exists()) continue;
    const current = snapshot.data()?.chapter_count;
    const count =
      typeof current === "number" && Number.isFinite(current) ? current : 0;
    transaction.update(reference, {
      chapter_count: Math.max(0, count + delta),
    });
  }
}

/**
 * Applies source-document counter changes within the caller's transaction.
 * Reads happen before writes, and bad or legacy values are treated as zero.
 */
export async function applyNonNegativeCounterDeltas(
  transaction: Transaction,
  deltas: MaintainedCounterDelta[],
): Promise<void> {
  const combined = new Map<string, MaintainedCounterDelta>();
  for (const delta of deltas) {
    if (delta.delta === 0) continue;
    const key = `${delta.reference.path}:${delta.field}`;
    const existing = combined.get(key);
    if (existing) existing.delta += delta.delta;
    else combined.set(key, { ...delta });
  }

  const nonZero = [...combined.values()].filter(({ delta }) => delta !== 0);
  const snapshots = await Promise.all(
    nonZero.map(async (delta) => ({
      delta,
      snapshot: await transaction.get(delta.reference),
    })),
  );
  for (const { delta, snapshot } of snapshots) {
    if (!snapshot.exists()) throw new Error("Request failed.");
    const current = snapshot.data()?.[delta.field];
    transaction.update(delta.reference, {
      [delta.field]: Math.max(
        0,
        (typeof current === "number" && Number.isFinite(current)
          ? current
          : 0) + delta.delta,
      ),
    });
  }
}

type CounterWriter = {
  update(
    reference: DocumentReference,
    data: Record<string, FieldValue>,
  ): unknown;
};

export function chapterCounterContribution(chapter: {
  kind?: ChapterKind;
  read_at?: Timestamp | null;
}): ChapterCounter {
  return chapter.kind === "chapter"
    ? { chapter_count: 1, read_count: chapter.read_at == null ? 0 : 1 }
    : { chapter_count: 0, read_count: 0 };
}

export function chapterCounterDelta(
  before: { kind?: ChapterKind; read_at?: Timestamp | null },
  after: { kind?: ChapterKind; read_at?: Timestamp | null },
): ChapterCounter {
  const beforeContribution = chapterCounterContribution(before);
  const afterContribution = chapterCounterContribution(after);
  return {
    chapter_count:
      afterContribution.chapter_count - beforeContribution.chapter_count,
    read_count: afterContribution.read_count - beforeContribution.read_count,
  };
}

export function applyChapterCounterDelta(
  writer: CounterWriter,
  novelId: string,
  volumeId: string,
  delta: ChapterCounter,
): void {
  const update = {
    ...(delta.chapter_count !== 0
      ? { chapter_count: increment(delta.chapter_count) }
      : {}),
    ...(delta.read_count !== 0
      ? { read_count: increment(delta.read_count) }
      : {}),
  };
  if (Object.keys(update).length === 0) return;

  writer.update(doc(db, "novels", novelId), update);
  writer.update(doc(db, "novels", novelId, "volumes", volumeId), update);
}
