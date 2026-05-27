"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Chapter, Tag } from "@/app/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cardClassName,
  ConfirmDialog,
  formatDisplayDate,
  ghostButtonClassName,
  iconButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  Snackbar,
  tagClassName,
} from "../ui";
import { deleteChapter, reorderChapters } from "@/libs/api";

export default function ChapterListWithFilters({
  novelId,
  volumeId,
  chapters,
  availableTags,
}: {
  novelId: string;
  volumeId: string;
  chapters: Chapter[];
  availableTags: Tag[];
}) {
  const { t } = useI18n();
  const router = useRouter();

  // ── filter state ──────────────────────────────────────────────────────────
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [deletedChapterIds, setDeletedChapterIds] = useState<string[]>([]);
  const [confirmChapter, setConfirmChapter] = useState<Chapter | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── reorder state ─────────────────────────────────────────────────────────
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedChapters, setOrderedChapters] = useState<Chapter[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const id = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(id);
  }, [snackbar]);

  // ── derived ───────────────────────────────────────────────────────────────
  const visibleChapters = useMemo(
    () => chapters.filter((ch) => !deletedChapterIds.includes(ch.id)),
    [chapters, deletedChapterIds],
  );

  const remainingTags = useMemo(
    () =>
      availableTags.filter(
        (tag) => !selectedTags.some((sel) => sel.id === tag.id),
      ),
    [availableTags, selectedTags],
  );

  const filteredChapters = useMemo(() => {
    if (selectedTags.length === 0) return visibleChapters;
    return visibleChapters.filter((ch) =>
      selectedTags.every((tag) =>
        ch.tags.some((chapterTag) => chapterTag.id === tag.id),
      ),
    );
  }, [visibleChapters, selectedTags]);

  // ── filter handlers ───────────────────────────────────────────────────────
  function addTag(tagId: string) {
    const tag = remainingTags.find((t) => t.id === tagId);
    if (!tag) return;
    setSelectedTags((cur) => [...cur, tag]);
  }

  function removeTag(tagId: string) {
    setSelectedTags((cur) => cur.filter((t) => t.id !== tagId));
  }

  // ── delete handler ────────────────────────────────────────────────────────
  async function handleDeleteChapter() {
    if (!confirmChapter) return;
    setDeletingId(confirmChapter.id);
    try {
      await deleteChapter(novelId, confirmChapter.volume_id, confirmChapter.id);
      setDeletedChapterIds((cur) => [...cur, confirmChapter.id]);
      setConfirmChapter(null);
      setSnackbar({ tone: "success", message: t("chapter.deleteSuccess") });
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

  // ── reorder handlers ──────────────────────────────────────────────────────
  function enterReorderMode() {
    setOrderedChapters([...visibleChapters]);
    setSelectedTags([]);
    setReorderMode(true);
  }

  function cancelReorder() {
    setReorderMode(false);
    dragIndex.current = null;
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragIndex.current;
    if (from === null || from === index) return;
    setOrderedChapters((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(index, 0, item);
      return next;
    });
    dragIndex.current = index;
  }

  function handleDragEnd() {
    dragIndex.current = null;
  }

  async function handleSaveOrder() {
    setReorderSaving(true);
    try {
      // Distribute existing numbers (sorted asc) to new positions so no novel-scope conflicts.
      const sortedNumbers = [...orderedChapters]
        .map((ch) => ch.number)
        .sort((a, b) => a - b);
      const entries = orderedChapters.map((ch, i) => ({
        id: ch.id,
        number: sortedNumbers[i],
      }));
      await reorderChapters(novelId, volumeId, entries);
      setReorderMode(false);
      setSnackbar({ tone: "success", message: t("chapter.reorderSuccess") });
      router.refresh();
    } catch (error) {
      setSnackbar({
        tone: "error",
        message:
          error instanceof Error ? error.message : t("common.networkError"),
      });
    } finally {
      setReorderSaving(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {reorderMode ? (
        <div className={cardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-500">{t("chapter.dragHint")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelReorder}
                disabled={reorderSaving}
                className={secondaryButtonClassName}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveOrder()}
                disabled={reorderSaving}
                className={primaryButtonClassName}>
                {reorderSaving ? t("common.saving") : t("chapter.saveOrder")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                onChange={(e) => addTag(e.target.value)}
                disabled={remainingTags.length === 0}
                className={`${inputClassName} w-auto min-w-40 appearance-none rounded-full py-2 pr-11 text-xs disabled:cursor-not-allowed disabled:text-stone-400`}>
                <option value="">{t("chapter.filters.addTag")}</option>
                {remainingTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={enterReorderMode}
              className={ghostButtonClassName}>
              {t("chapter.reorder")}
            </button>
          </div>
        </div>
      )}

      {reorderMode ? (
        orderedChapters.length === 0 ? null : (
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {orderedChapters.map((chapter, index) => (
              <li
                key={chapter.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing active:opacity-50">
                <div className={`${listRowClassName} select-none`}>
                  <span className="shrink-0 text-stone-400" aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true">
                      <circle cx="5" cy="3" r="1.5" />
                      <circle cx="11" cy="3" r="1.5" />
                      <circle cx="5" cy="8" r="1.5" />
                      <circle cx="11" cy="8" r="1.5" />
                      <circle cx="5" cy="13" r="1.5" />
                      <circle cx="11" cy="13" r="1.5" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-stone-900">
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : filteredChapters.length === 0 ? (
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
