import type { ChapterKind } from "@/app/types";

export const CHAPTER_KINDS: ChapterKind[] = [
  "chapter",
  "prologue",
  "epilogue",
  "afterword",
  "side_story",
  "other",
];

export type ChapterLabelInput = {
  number: number | null;
  kind: ChapterKind;
  custom_label: string | null;
  title: string;
};

export type ChapterKindLabels = Record<ChapterKind, string>;

export function formatChapterPrefix(
  chapter: ChapterLabelInput,
  labels: ChapterKindLabels,
) {
  return chapter.kind === "chapter"
    ? `${labels.chapter} ${chapter.number ?? ""}`.trim()
    : chapter.kind === "other"
      ? chapter.custom_label ?? labels.other
      : labels[chapter.kind];
}

export function formatChapterLabel(
  chapter: ChapterLabelInput,
  labels: ChapterKindLabels,
) {
  const prefix = formatChapterPrefix(chapter, labels);
  return `${prefix} — ${chapter.title}`;
}
