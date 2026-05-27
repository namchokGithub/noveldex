"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Chapter, Tag } from "@/app/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cardClassName,
  ConfirmDialog,
  formatDisplayDate,
  iconButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  Snackbar,
  tagClassName,
} from "../ui";
import { deleteChapter } from "@/libs/api";

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
  const router = useRouter();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [confirmChapter, setConfirmChapter] = useState<Chapter | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedChapterIds, setDeletedChapterIds] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  const remainingTags = useMemo(
    () =>
      availableTags.filter(
        (tag) => !selectedTags.some((selected) => selected.id === tag.id),
      ),
    [availableTags, selectedTags],
  );

  const filteredChapters = useMemo(() => {
    const visibleChapters = chapters.filter(
      (chapter) => !deletedChapterIds.includes(chapter.id),
    );

    if (selectedTags.length === 0) return visibleChapters;
    return visibleChapters.filter((chapter) =>
      selectedTags.every((tag) =>
        chapter.tags.some((chapterTag) => chapterTag.id === tag.id),
      ),
    );
  }, [chapters, deletedChapterIds, selectedTags]);

  function addTag(tagId: string) {
    const tag = remainingTags.find((entry) => entry.id === tagId);
    if (!tag) return;
    setSelectedTags((current) => [...current, tag]);
  }

  function removeTag(tagId: string) {
    setSelectedTags((current) => current.filter((tag) => tag.id !== tagId));
  }

  async function handleDeleteChapter() {
    if (!confirmChapter) return;

    setDeletingId(confirmChapter.id);

    try {
      await deleteChapter(novelId, confirmChapter.volume_id, confirmChapter.id);
      setDeletedChapterIds((current) => [...current, confirmChapter.id]);
      setConfirmChapter(null);
      setSnackbar({
        tone: "success",
        message: t("chapter.deleteSuccess"),
      });
      router.refresh();
    } catch (error) {
      setSnackbar({
        tone: "error",
        message:
          error instanceof Error ? error.message : t("common.networkError"),
      });
    } finally {
      setDeletingId(null);
    }
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
              <div className={listRowClassName}>
                <Link
                  href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}`}
                  className="min-w-0 flex-1 rounded-2xl outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
                  <div className="text-sm font-medium text-stone-900 transition hover:text-stone-700">
                    Ch. {chapter.number} — {chapter.title}
                  </div>
                  {chapter.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chapter.tags.map((tag) => (
                        <span key={tag.id} className={tagClassName}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {chapter.read_at ? (
                    <span className="text-xs text-stone-500">
                      {formatDisplayDate(chapter.read_at) ?? chapter.read_at}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setConfirmChapter(chapter)}
                    disabled={deletingId === chapter.id}
                    className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
                    aria-label={t("chapter.deleteAria", {
                      number: chapter.number,
                    })}>
                    🗑️
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirmChapter)}
        eyebrow={t("chapter.confirmEyebrow")}
        title={t("chapter.deleteConfirmTitle")}
        description={t("chapter.deleteConfirmBody", {
          number: confirmChapter?.number ?? "",
          title: confirmChapter?.title ?? "",
        })}
        confirmLabel={deletingId ? t("chapter.deleting") : t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleDeleteChapter()}
        onCancel={() => setConfirmChapter(null)}
        busy={deletingId !== null}
        danger
      />

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </>
  );
}
