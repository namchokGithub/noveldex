import type { NovelEvent } from "@/app/types";

export interface ChapterOrderInput {
  id: string;
  volume_id: string;
  sort_order: number;
}
export interface VolumeOrderInput {
  id: string;
  number: number;
}

const UNKNOWN = Number.MAX_SAFE_INTEGER;

export function nextEventPosition(
  events: Pick<
    NovelEvent,
    "chapter_id" | "chapter_volume_id" | "page_number" | "sort_order"
  >[],
  group: { volumeId: string; chapterId: string; pageNumber: number | null },
): number {
  const positions = events
    .filter(
      (event) =>
        event.chapter_volume_id === group.volumeId &&
        event.chapter_id === group.chapterId &&
        event.page_number === group.pageNumber,
    )
    .map((event) => event.sort_order);

  return Math.max(-1, ...positions) + 1;
}

export function eventOrder(
  a: NovelEvent,
  b: NovelEvent,
  chapters: ReadonlyMap<string, ChapterOrderInput>,
  volumes: ReadonlyMap<string, VolumeOrderInput>,
): number {
  const chapterA = a.chapter_id ? chapters.get(a.chapter_id) : undefined;
  const chapterB = b.chapter_id ? chapters.get(b.chapter_id) : undefined;
  const volumeA = volumes.get(a.chapter_volume_id ?? chapterA?.volume_id ?? "");
  const volumeB = volumes.get(b.chapter_volume_id ?? chapterB?.volume_id ?? "");
  return (
    [
      (volumeA?.number ?? UNKNOWN) - (volumeB?.number ?? UNKNOWN),
      (chapterA?.sort_order ?? UNKNOWN) - (chapterB?.sort_order ?? UNKNOWN),
      (a.page_number ?? UNKNOWN) - (b.page_number ?? UNKNOWN),
      a.sort_order - b.sort_order,
      a.id.localeCompare(b.id),
    ].find((value) => value !== 0) ?? 0
  );
}

export function chapterEventOrder(
  a: Pick<NovelEvent, "id" | "page_number" | "sort_order">,
  b: Pick<NovelEvent, "id" | "page_number" | "sort_order">,
): number {
  return (
    [
      (a.page_number ?? UNKNOWN) - (b.page_number ?? UNKNOWN),
      a.sort_order - b.sort_order,
      a.id.localeCompare(b.id),
    ].find((value) => value !== 0) ?? 0
  );
}
