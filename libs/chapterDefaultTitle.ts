import type { ChapterKind } from "@/app/types";

const DEFAULT_AFTERWORD_TITLE = "Fuse";

export function titleForChapterKind(
  kind: ChapterKind,
  currentTitle: string,
): string {
  return kind === "afterword" && !currentTitle.trim()
    ? DEFAULT_AFTERWORD_TITLE
    : currentTitle;
}
