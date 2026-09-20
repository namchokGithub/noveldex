"use client";

import {
  ADAPTATION_ENTRY_TYPES,
  ADAPTATION_MEDIA,
  type ChapterSummary,
} from "@/app/types";
import {
  inputClassName,
  smallLabelClassName,
  textareaClassName,
} from "@/app/novels/ui";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizedVolumeTitle } from "@/libs/volumeTitle";
import type { VolumeSearchSource } from "@/libs/firebase/volumes";
import { formatChapterLabel } from "@/libs/chapterLabel";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import { Select } from "@/components/ui/Select";

export type AdaptationFormState = {
  volume_id: string;
  medium: string;
  group_label: string;
  group_sort_order: string;
  entry_type: string;
  entry_number: string;
  title: string;
  source_url: string;
  source_img_url: string;
  description: string;
  sort_order: string;
  adapted_chapter_ids: string[];
};

export default function AdaptationFormFields({
  form,
  onChange,
  volumes,
  chapters,
  volumeLocked = false,
}: {
  form: AdaptationFormState;
  onChange: (next: AdaptationFormState) => void;
  volumes: VolumeSearchSource[];
  chapters: ChapterSummary[];
  volumeLocked?: boolean;
}) {
  const { language, t } = useI18n();
  const chapterLabels = useChapterKindLabels();
  const volumeChapters = chapters.filter(
    (chapter) => chapter.volume_id === form.volume_id,
  );
  const set =
    (field: keyof AdaptationFormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      onChange({ ...form, [field]: event.target.value });
  const setValue = (field: keyof AdaptationFormState) => (value: string) =>
    onChange({ ...form, [field]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.volume")}
        </span>
        <Select
          value={form.volume_id}
          onValueChange={setValue("volume_id")}
          disabled={volumeLocked}
          options={volumes.map((volume) => ({
            value: volume.id,
            label: `${volume.number} · ${localizedVolumeTitle(volume, language)}`,
          }))}
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.medium")}
        </span>
        <Select
          value={form.medium}
          onValueChange={setValue("medium")}
          options={ADAPTATION_MEDIA.map((medium) => ({ value: medium, label: medium }))}
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.group")}
        </span>
        <input
          className={inputClassName}
          value={form.group_label}
          onChange={set("group_label")}
          required
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.groupOrder")}
        </span>
        <input
          className={inputClassName}
          type="number"
          min="1"
          value={form.group_sort_order}
          onChange={set("group_sort_order")}
          required
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.entryType")}
        </span>
        <Select
          value={form.entry_type}
          onValueChange={setValue("entry_type")}
          options={ADAPTATION_ENTRY_TYPES.map((entryType) => ({ value: entryType, label: entryType }))}
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.entryNumber")}
        </span>
        <input
          className={inputClassName}
          type="number"
          min="1"
          value={form.entry_number}
          onChange={set("entry_number")}
          required
        />
      </label>
      <label className="sm:col-span-2">
        <span className={smallLabelClassName}>
          {t("adaptations.field.title")}
        </span>
        <input
          className={inputClassName}
          value={form.title}
          onChange={set("title")}
          required
        />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className={smallLabelClassName}>
          {t("adaptations.field.chapters")}
        </legend>
        {volumeChapters.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            {t("adaptations.noChapters")}
          </p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {volumeChapters.map((chapter) => {
              const checked = form.adapted_chapter_ids.includes(chapter.id);
              return (
                <label
                  key={chapter.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        ...form,
                        adapted_chapter_ids: checked
                          ? form.adapted_chapter_ids.filter(
                              (id) => id !== chapter.id,
                            )
                          : [...form.adapted_chapter_ids, chapter.id],
                      })
                    }
                  />
                  {formatChapterLabel(chapter, chapterLabels)} · {chapter.title}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.sortOrder")}
        </span>
        <input
          className={inputClassName}
          type="number"
          min="1"
          value={form.sort_order}
          onChange={set("sort_order")}
          required
        />
      </label>
      <label>
        <span className={smallLabelClassName}>
          {t("adaptations.field.sourceUrl")}
        </span>
        <input
          className={inputClassName}
          type="url"
          value={form.source_url}
          onChange={set("source_url")}
        />
      </label>
      <label className="sm:col-span-2">
        <span className={smallLabelClassName}>
          {t("adaptations.field.imageUrl")}
        </span>
        <input
          className={inputClassName}
          type="url"
          value={form.source_img_url}
          onChange={set("source_img_url")}
        />
      </label>
      <label className="sm:col-span-2">
        <span className={smallLabelClassName}>
          {t("adaptations.field.description")}
        </span>
        <textarea
          className={textareaClassName}
          maxLength={500}
          value={form.description}
          onChange={set("description")}
        />
      </label>
    </div>
  );
}
