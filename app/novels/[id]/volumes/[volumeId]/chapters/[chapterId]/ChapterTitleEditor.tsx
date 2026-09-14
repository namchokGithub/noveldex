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
  const [titleEn, setTitleEn] = useState(chapter.title_en ?? chapter.title ?? "");
  const [titleTh, setTitleTh] = useState(chapter.title_th ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const normalizedTitleEn = titleEn.trim();
    const normalizedTitleTh = titleTh.trim();
    if (!normalizedTitleEn) {
      setError(t("chapter.titleRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateChapter(novelId, volumeId, chapter.id, {
        title_en: normalizedTitleEn,
        title_th: normalizedTitleTh,
      });
      upsert(normalizeChapter(novelId, updated, entityMap, kindLabels));
      setTitleEn(normalizedTitleEn);
      setTitleTh(normalizedTitleTh);
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
        <span>{titleTh || titleEn}</span>
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
    <span className="grid w-full gap-2">
      <label className="text-sm font-medium text-stone-700">
        {t("addChapter.titleEnglishRequired")}
      <input
        autoFocus
        value={titleEn}
        onChange={(event) => setTitleEn(event.target.value)}
        className={`${inputClassName} mt-1 w-full py-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl`}
        placeholder={t("addChapter.titleEnglishPlaceholder")}
      />
      </label>
      <label className="text-sm font-medium text-stone-700">
        {t("addChapter.titleThaiOptional")}
        <input
          value={titleTh}
          onChange={(event) => setTitleTh(event.target.value)}
          className={`${inputClassName} mt-1 w-full py-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl`}
          placeholder={t("addChapter.titleThaiPlaceholder")}
        />
      </label>
      <span className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void save()} disabled={saving} className={primaryButtonClassName}>
        {saving ? t("common.saving") : t("chapter.saveTitle")}
      </button>
      <button
        type="button"
        onClick={() => {
          setTitleEn(chapter.title_en ?? chapter.title ?? "");
          setTitleTh(chapter.title_th ?? "");
          setError(null);
          setEditing(false);
        }}
        disabled={saving}
        className={secondaryButtonClassName}>
        {t("common.cancel")}
      </button>
      {error ? <span role="alert" className="w-full text-sm font-normal text-rose-600">{error}</span> : null}
      </span>
    </span>
  );
}
