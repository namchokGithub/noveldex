"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Chapter, Tag } from "@/app/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cardClassName,
  formatDisplayDate,
  inputClassName,
  listClassName,
  listRowClassName,
  tagClassName,
} from "../ui";

export default function ChapterListWithFilters({
  novelId,
  chapters,
  availableTags,
}: {
  novelId: string;
  chapters: Chapter[];
  availableTags: Tag[];
}) {
  const { t } = useI18n();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const remainingTags = useMemo(
    () =>
      availableTags.filter(
        (tag) => !selectedTags.some((selected) => selected.id === tag.id),
      ),
    [availableTags, selectedTags],
  );

  const filteredChapters = useMemo(() => {
    if (selectedTags.length === 0) return chapters;
    return chapters.filter((chapter) =>
      selectedTags.every((tag) =>
        chapter.tags.some((chapterTag) => chapterTag.id === tag.id),
      ),
    );
  }, [chapters, selectedTags]);

  function addTag(tagId: string) {
    const tag = remainingTags.find((entry) => entry.id === tagId);
    if (!tag) return;
    setSelectedTags((current) => [...current, tag]);
  }

  function removeTag(tagId: string) {
    setSelectedTags((current) => current.filter((tag) => tag.id !== tagId));
  }

  return (
    <>
      <div className={cardClassName}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-stone-700">
            {t("chapter.filters.tags")}
          </span>
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => removeTag(tag.id)}
              className={tagClassName}>
              {tag.name}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <select
            value=""
            onChange={(event) => addTag(event.target.value)}
            disabled={remainingTags.length === 0}
            className={`${inputClassName} appearance-none w-auto min-w-40 rounded-full py-2 pr-11 text-xs disabled:cursor-not-allowed disabled:text-stone-400`}>
            <option value="">{t("chapter.filters.addTag")}</option>
            {remainingTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredChapters.length === 0 ? (
        <div className="flex min-h-55 items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
          {t("chapter.filters.noMatch")}
        </div>
      ) : (
        <ul className={`${listClassName} divide-y divide-stone-200`}>
          {filteredChapters.map((chapter) => (
            <li key={chapter.id}>
              <Link
                href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}`}
                className={listRowClassName}>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-stone-900">
                    Ch. {chapter.number} — {chapter.title}
                  </span>
                  {chapter.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chapter.tags.map((tag) => (
                        <span key={tag.id} className={tagClassName}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {chapter.read_at && (
                  <span className="shrink-0 text-xs text-stone-500">
                    {formatDisplayDate(chapter.read_at) ?? chapter.read_at}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
