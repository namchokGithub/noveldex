import type { ChapterKind } from "@/app/types";

const DEFAULT_OTHER_CHAPTER_LABEL = "Interlude";

export function customLabelForKind(
  kind: ChapterKind,
  currentLabel: string,
): string {
  return kind === "other" && !currentLabel.trim()
    ? DEFAULT_OTHER_CHAPTER_LABEL
    : currentLabel;
}
