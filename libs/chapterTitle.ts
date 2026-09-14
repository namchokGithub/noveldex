import type { Locale } from "@/components/i18n/I18nProvider";

export type ChapterTitleSource = {
  title: string;
  title_en?: string;
  title_th?: string;
};

export function localizedChapterTitle(chapter: ChapterTitleSource, language: Locale): string {
  if (language === "th") return chapter.title_th || chapter.title_en || chapter.title;
  return chapter.title_en || chapter.title;
}
