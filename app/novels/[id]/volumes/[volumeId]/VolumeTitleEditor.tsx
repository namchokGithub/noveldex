"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Volume } from "@/app/types";
import {
  FormError,
  ghostButtonClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useResetOnSignOut } from "@/components/auth/useResetOnSignOut";
import { updateVolume } from "@/libs/api";
import { shouldCancelInlineEdit } from "@/libs/inlineEditKeyboard";
import { localizedVolumeTitle } from "@/libs/volumeTitle";
import { normalizeVolume } from "@/libs/search/normalize";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";

export function volumeTitlePayload(
  titleEn: string,
  titleTh: string,
  sourceImageUrl: string,
) {
  return {
    title_en: titleEn.trim(),
    title_th: titleTh.trim(),
    source_img_url: sourceImageUrl.trim() || null,
  };
}

export default function VolumeTitleEditor({
  volume,
  novelId,
}: {
  volume: Pick<
    Volume,
    | "id"
    | "novel_id"
    | "number"
    | "title"
    | "title_en"
    | "title_th"
    | "description"
    | "source_img_url"
  >;
  novelId: string;
}) {
  const { t, language } = useI18n();
  const { isAdmin } = useAuth();
  const { upsert } = useSearchIndex();
  const router = useRouter();
  const [titleEn, setTitleEn] = useState(volume.title_en ?? volume.title);
  const [titleTh, setTitleTh] = useState(volume.title_th ?? "");
  const [sourceImageUrl, setSourceImageUrl] = useState(
    volume.source_img_url ?? "",
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setTitleEn(volume.title_en ?? volume.title);
    setTitleTh(volume.title_th ?? "");
    setSourceImageUrl(volume.source_img_url ?? "");
    setError(null);
    setEditing(false);
  }

  useResetOnSignOut(isAdmin, cancel);

  async function save() {
    const payload = volumeTitlePayload(titleEn, titleTh, sourceImageUrl);
    if (!payload.title_en) {
      setError(t("volume.titleRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateVolume(novelId, volume.id, payload);
      upsert(normalizeVolume(updated));
      setTitleEn(updated.title_en);
      setTitleTh(updated.title_th);
      setSourceImageUrl(updated.source_img_url ?? "");
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
        <span>{localizedVolumeTitle({ ...volume, title_en: titleEn, title_th: titleTh }, language)}</span>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${ghostButtonClassName} px-2 py-1 text-sm`}
            aria-label={t("volume.editTitle")}>
            {t("common.edit")}
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="grid w-full gap-2">
      <label className="text-sm font-medium text-stone-700">
        {t("volume.titleEnglishRequired")}
        <input
          autoFocus
          value={titleEn}
          onChange={(event) => setTitleEn(event.target.value)}
          onKeyDown={(event) => {
            if (shouldCancelInlineEdit(event.key, saving)) {
              event.preventDefault();
              cancel();
            }
          }}
          className={`${inputClassName} mt-1 w-full py-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl`}
          placeholder={t("addVolume.titlePlaceholder")}
        />
      </label>
      <label className="text-sm font-medium text-stone-700">
        {t("volume.titleThaiOptional")}
        <input
          value={titleTh}
          onChange={(event) => setTitleTh(event.target.value)}
          onKeyDown={(event) => {
            if (shouldCancelInlineEdit(event.key, saving)) {
              event.preventDefault();
              cancel();
            }
          }}
          className={`${inputClassName} mt-1 w-full py-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl`}
        />
      </label>
      <label className="text-sm font-medium text-stone-700">
        {t("addVolume.sourceImageUrl")}
        <input
          type="url"
          value={sourceImageUrl}
          onChange={(event) => setSourceImageUrl(event.target.value)}
          onKeyDown={(event) => {
            if (shouldCancelInlineEdit(event.key, saving)) {
              event.preventDefault();
              cancel();
            }
          }}
          className={`${inputClassName} mt-1 w-full py-1 text-base font-normal tracking-normal`}
          placeholder="https://example.com/image.jpg"
        />
      </label>
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={primaryButtonClassName}>
          {saving ? t("common.saving") : t("volume.saveTitle")}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className={secondaryButtonClassName}>
          {t("common.cancel")}
        </button>
      </span>
      {error ? <FormError>{error}</FormError> : null}
    </span>
  );
}
