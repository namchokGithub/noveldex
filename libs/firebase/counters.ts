import type { ChapterKind } from "@/app/types";
import {
  doc,
  increment,
  type DocumentReference,
  type FieldValue,
  type Timestamp,
} from "firebase/firestore/lite";
import { db } from "./app";

export type ChapterCounter = {
  chapter_count: number;
  read_count: number;
};

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
