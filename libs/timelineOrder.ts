import type { NovelEvent } from "@/app/types";

export interface ChapterOrderInput { id: string; volume_id: string; sort_order: number }
export interface VolumeOrderInput { id: string; number: number }

const UNKNOWN = Number.MAX_SAFE_INTEGER;

export function eventOrder(a: NovelEvent, b: NovelEvent, chapters: ChapterOrderInput[], volumes: VolumeOrderInput[]): number {
  const chapterA = chapters.find((chapter) => chapter.id === a.chapter_id);
  const chapterB = chapters.find((chapter) => chapter.id === b.chapter_id);
  const volumeA = volumes.find((volume) => volume.id === (a.chapter_volume_id ?? chapterA?.volume_id));
  const volumeB = volumes.find((volume) => volume.id === (b.chapter_volume_id ?? chapterB?.volume_id));
  return [
    (volumeA?.number ?? UNKNOWN) - (volumeB?.number ?? UNKNOWN),
    (chapterA?.sort_order ?? UNKNOWN) - (chapterB?.sort_order ?? UNKNOWN),
    (a.page_number ?? UNKNOWN) - (b.page_number ?? UNKNOWN),
    a.sort_order - b.sort_order,
    a.id.localeCompare(b.id),
  ].find((value) => value !== 0) ?? 0;
}
