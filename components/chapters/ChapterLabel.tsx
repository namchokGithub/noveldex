"use client";

import type { ChapterKind } from "@/app/types";
import { useMemo } from "react";
import { formatChapterLabel, type ChapterLabelInput } from "@/libs/chapterLabel";
import { useI18n } from "@/components/i18n/I18nProvider";

export function useChapterKindLabels() {
  const { t } = useI18n();
  return useMemo(() => ({
    chapter: t("chapter.kind.chapter"),
    prologue: t("chapter.kind.prologue"),
    epilogue: t("chapter.kind.epilogue"),
    afterword: t("chapter.kind.afterword"),
    side_story: t("chapter.kind.sideStory"),
    other: t("chapter.kind.other"),
  }) satisfies Record<ChapterKind, string>, [t]);
}

export function ChapterLabel({ chapter }: { chapter: ChapterLabelInput }) {
  return <>{formatChapterLabel(chapter, useChapterKindLabels())}</>;
}
