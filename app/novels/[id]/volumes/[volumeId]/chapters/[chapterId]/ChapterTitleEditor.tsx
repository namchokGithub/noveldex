"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterWithCharacters } from "@/app/types";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ghostButtonClassName, inputClassName, primaryButtonClassName, secondaryButtonClassName } from "@/app/novels/ui";
import { updateChapter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { normalizeChapter } from "@/libs/search/normalize";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";

export default function ChapterTitleEditor({
  chapter,
  novelId,
  volumeId,
}: {
  chapter: ChapterWithCharacters;
  novelId: string;
  volumeId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const kindLabels = useChapterKindLabels();
  const { entityMap, upsert } = useSearchIndex();
  const { isAdmin } = useAuth();
  const [title, setTitle] = useState(chapter.title ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError(t("chapter.titleRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, {
        title: normalizedTitle,
      });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setTitle(normalizedTitle);
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{title}</span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${ghostButtonClassName} px-2 py-1 text-sm`}
            aria-label={t("chapter.editTitle")}>
            {t("common.edit")}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex w-full flex-wrap items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className={`${inputClassName} min-w-52 flex-1 py-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl`}
        placeholder={t("addChapter.chapterTitlePlaceholder")}
      />
      <button type="button" onClick={() => void save()} disabled={saving} className={primaryButtonClassName}>
        {saving ? t("common.saving") : t("chapter.saveTitle")}
      </button>
      <button
        type="button"
        onClick={() => {
          setTitle(chapter.title ?? "");
          setError(null);
          setEditing(false);
        }}
        disabled={saving}
        className={secondaryButtonClassName}>
        {t("common.cancel")}
      </button>
      {error ? <span role="alert" className="w-full text-sm font-normal text-rose-600">{error}</span> : null}
    </span>
  );
}
