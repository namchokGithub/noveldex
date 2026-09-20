"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Adaptation,
  AdaptationEntryType,
  AdaptationMedium,
  ChapterSummary,
} from "@/app/types";
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  FormError,
  ghostButtonClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  SectionHeading,
  Snackbar,
  smallLabelClassName,
} from "@/app/novels/ui";
import ConfirmDialog from "@/app/novels/ConfirmDialog";
import ModalDialog from "@/components/a11y/ModalDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { groupAdaptations } from "@/libs/adaptations/order";
import {
  createAdaptation,
  deleteAdaptation,
  reorderAdaptations,
  updateAdaptation,
  type AdaptationCreatePayload,
} from "@/libs/api";
import type { VolumeSearchSource } from "@/libs/firebase/volumes";
import { Select } from "@/components/ui/Select";
import { localizedVolumeTitle } from "@/libs/volumeTitle";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeAdaptation } from "@/libs/search/normalize";
import AdaptationFormFields, {
  type AdaptationFormState,
} from "./AdaptationFormFields";
import AdaptationImageModal from "./AdaptationImageModal";
import AdaptationNotesPreview from "./AdaptationNotesPreview";
import { formatChapterLabel } from "@/libs/chapterLabel";
import { chapterPreview } from "@/libs/adaptations/chapterPreview";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";

const emptyForm = (volumeId = "", sortOrder = "1"): AdaptationFormState => ({
  volume_id: volumeId,
  medium: "anime",
  group_label: "Season 1",
  group_sort_order: "1",
  entry_type: "episode",
  entry_number: "1",
  title: "",
  source_url: "",
  source_img_url: "",
  description: "",
  sort_order: sortOrder,
  adapted_chapter_ids: [],
});
const formFor = (item: Adaptation): AdaptationFormState => ({
  volume_id: item.volume_id,
  medium: item.medium,
  group_label: item.group_label,
  group_sort_order: String(item.group_sort_order),
  entry_type: item.entry_type,
  entry_number: String(item.entry_number),
  title: item.title,
  source_url: item.source_url ?? "",
  source_img_url: item.source_img_url ?? "",
  description: item.description,
  sort_order: String(item.sort_order),
  adapted_chapter_ids: item.adapted_chapter_ids,
});

export default function AdaptationTimeline({
  novelId,
  novelTitle,
  volumes,
  initialAdaptations,
  chapters,
}: {
  novelId: string;
  novelTitle: string;
  volumes: VolumeSearchSource[];
  initialAdaptations: Adaptation[];
  chapters: ChapterSummary[];
}) {
  const { t, language } = useI18n();
  const chapterLabels = useChapterKindLabels();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { entityMap, upsert, discard } = useSearchIndex();
  const volumeById = useMemo(
    () => new Map(volumes.map((volume) => [volume.id, volume])),
    [volumes],
  );
  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  const [items, setItems] = useState(initialAdaptations);
  const [volumeFilter, setVolumeFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(() => emptyForm(volumes[0]?.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Adaptation | null>(null);
  const [chapterDialogAdaptation, setChapterDialogAdaptation] =
    useState<Adaptation | null>(null);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const timeout = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [snackbar]);
  const nextSortOrder = (next: AdaptationFormState) => ({
    ...next,
    sort_order: String(
      items
        .filter(
          (item) =>
            item.volume_id === next.volume_id &&
            item.medium === next.medium &&
            item.group_label === next.group_label &&
            item.group_sort_order === Number(next.group_sort_order),
        )
        .reduce((max, item) => Math.max(max, item.sort_order), 0) + 1,
    ),
  });
  const setAddForm = (next: AdaptationFormState) =>
    setForm((current) => {
      const volumeChanged = current.volume_id !== next.volume_id;
      const normalized = volumeChanged
        ? { ...next, adapted_chapter_ids: [] }
        : next;
      return current.group_label !== normalized.group_label ||
        current.group_sort_order !== normalized.group_sort_order ||
        current.medium !== normalized.medium ||
        volumeChanged
        ? nextSortOrder(normalized)
        : normalized;
    });
  const payload = (value: AdaptationFormState): AdaptationCreatePayload => ({
    medium: value.medium as AdaptationMedium,
    group_label: value.group_label,
    group_sort_order: Number(value.group_sort_order),
    entry_type: value.entry_type as AdaptationEntryType,
    entry_number: Number(value.entry_number),
    title: value.title,
    source_url: value.source_url || null,
    source_img_url: value.source_img_url || null,
    description: value.description,
    sort_order: Number(value.sort_order),
    adapted_chapter_ids: value.adapted_chapter_ids,
  });
  const saveAdd = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await createAdaptation(
        novelId,
        form.volume_id,
        payload(form),
      );
      setItems((current) => [...current, saved]);
      upsert(
        normalizeAdaptation(saved, volumeById.get(saved.volume_id), entityMap),
      );
      setShowAdd(false);
      setForm(emptyForm(volumes[0]?.id));
      setSnackbar({ tone: "success", message: t("adaptations.addSuccess") });
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    const previous = items.find((item) => item.id === editing);
    if (!previous) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await updateAdaptation(
        novelId,
        previous.volume_id,
        previous.id,
        payload(form),
      );
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      upsert(
        normalizeAdaptation(saved, volumeById.get(saved.volume_id), entityMap),
      );
      setEditing(null);
      setSnackbar({ tone: "success", message: t("adaptations.editSuccess") });
      router.refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  };
  const deleteConfirmed = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteAdaptation(
        novelId,
        confirmDelete.volume_id,
        confirmDelete.id,
      );
      setItems((current) =>
        current.filter((item) => item.id !== confirmDelete.id),
      );
      discard(
        `adaptation:${novelId}:${confirmDelete.volume_id}:${confirmDelete.id}`,
      );
      setConfirmDelete(null);
      setSnackbar({ tone: "success", message: t("adaptations.deleteSuccess") });
      router.refresh();
    } catch (cause) {
      setSnackbar({ tone: "error", message: userErrorMessage(cause, t) });
    } finally {
      setBusy(false);
    }
  };
  const reorder = async (
    groupItems: Adaptation[],
    index: number,
    direction: -1 | 1,
  ) => {
    const target = index + direction;
    if (target < 0 || target >= groupItems.length) return;
    const swapped = [...groupItems];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    const positions = swapped.map((item, position) => ({
      id: item.id,
      sort_order: position + 1,
    }));
    try {
      await reorderAdaptations(novelId, swapped[0].volume_id, positions);
      const byId = new Map(
        positions.map((entry) => [entry.id, entry.sort_order]),
      );
      setItems((current) =>
        current.map((item) =>
          byId.has(item.id)
            ? { ...item, sort_order: byId.get(item.id)! }
            : item,
        ),
      );
      setSnackbar({
        tone: "success",
        message: t("adaptations.reorderSuccess"),
      });
    } catch (cause) {
      setSnackbar({ tone: "error", message: userErrorMessage(cause, t) });
    }
  };
  const displayedVolumes = volumes.filter(
    (volume) => volumeFilter === "all" || volume.id === volumeFilter,
  );
  const volumeGroups = displayedVolumes
    .map((volume) => ({
      volume,
      groups: groupAdaptations(
        items.filter((item) => item.volume_id === volume.id),
      ),
    }))
    .filter(({ groups }) => groups.length > 0);

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <Link href={`/novels/${novelId}`} className={backLinkClassName}>
          ← {novelTitle}
        </Link>
        <SectionHeading
          eyebrow={t("adaptations.title")}
          title={t("adaptations.pageTitle")}
          description={t("adaptations.pageDescription")}
          action={
            isAdmin ? (
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  setError(null);
                  setForm(nextSortOrder(emptyForm(volumes[0]?.id)));
                  setShowAdd(true);
                }}>
                + {t("adaptations.add")}
              </button>
            ) : null
          }
        />
        <label className="block max-w-xs">
          <span className={smallLabelClassName}>
            {t("adaptations.filterVolume")}
          </span>
          <Select
            value={volumeFilter}
            onValueChange={setVolumeFilter}
            options={[
              { value: "all", label: t("adaptations.allVolumes") },
              ...volumes.map((volume) => ({
                value: volume.id,
                label: `${t("adaptations.volume")} ${volume.number} · ${localizedVolumeTitle(volume, language)}`,
              })),
            ]}
          />
        </label>
        {showAdd && isAdmin ? (
          <form className={`${cardClassName} space-y-4`} onSubmit={saveAdd}>
            <h2 className="font-semibold">{t("adaptations.addTitle")}</h2>
            <AdaptationFormFields
              form={form}
              onChange={setAddForm}
              volumes={volumes}
              chapters={chapters}
            />
            {error ? <FormError>{error}</FormError> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => setShowAdd(false)}>
                {t("common.cancel")}
              </button>
              <button disabled={busy} className={primaryButtonClassName}>
                {t("common.save")}
              </button>
            </div>
          </form>
        ) : null}
        {volumeGroups.length === 0 ? (
          <section className={cardClassName}>
            <p className="text-stone-500">{t("adaptations.emptyNovel")}</p>
          </section>
        ) : (
          volumeGroups.map(({ volume, groups }) => (
            <section key={volume.id} className={cardClassName}>
              <h2 className="text-lg font-semibold text-stone-950">
                {t("adaptations.volume")} {volume.number} ·{" "}
                {localizedVolumeTitle(volume, language)}
              </h2>
              <div className="mt-4 space-y-5">
                {groups.map((group) => (
                  <div key={group.key}>
                    <h3 className="text-sm font-semibold text-stone-700">
                      {group.medium} · {group.group_label}
                    </h3>
                    <div className="mt-2 divide-y divide-stone-200">
                      {group.items.map((item, index) => (
                        <div
                          id={`adaptation-${item.id}`}
                          key={item.id}
                          className="py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-1 min-w-0 items-start gap-3">
                              <AdaptationImageModal adaptation={item} />
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-baseline gap-2">
                                  <Link
                                    href={`/novels/${novelId}/volumes/${item.volume_id}/adaptations/${item.id}`}
                                    className="min-w-0 flex-1 truncate font-medium text-stone-900 transition hover:text-stone-600">
                                    {item.entry_type} {item.entry_number} ·{" "}
                                    {item.title}
                                  </Link>
                                  {item.source_url ? (
                                    <a
                                      className="shrink-0 text-sm text-sky-700 hover:underline"
                                      href={item.source_url}
                                      target="_blank"
                                      rel="noreferrer">
                                      {t("adaptations.source")}
                                    </a>
                                  ) : null}
                                </div>
                                {item.description ? (
                                  <p className="mt-2 text-sm text-stone-600">
                                    {item.description}
                                  </p>
                                ) : null}
                                {item.adapted_chapter_ids.length > 0 ? (() => {
                                  const { visibleId, hiddenIds } = chapterPreview(
                                    item.adapted_chapter_ids,
                                  );
                                  const chapter = visibleId
                                    ? chapterById.get(visibleId)
                                    : undefined;
                                  return (
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                      {chapter ? (
                                        <Link
                                          href={`/novels/${novelId}/volumes/${item.volume_id}/chapters/${chapter.id}`}
                                          className="text-sky-700 hover:underline">
                                          {formatChapterLabel(chapter, chapterLabels)} ·{" "}
                                          {chapter.title}
                                        </Link>
                                      ) : null}
                                      {hiddenIds.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setChapterDialogAdaptation(item)
                                          }
                                          className="text-sky-700 hover:underline">
                                          {t("adaptations.viewAllChapters", {
                                            count: item.adapted_chapter_ids.length,
                                          })}
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })() : null}
                                <AdaptationNotesPreview adaptation={item} />
                              </div>
                            </div>
                            {isAdmin ? (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  disabled={busy || index === 0}
                                  onClick={() =>
                                    void reorder(group.items, index, -1)
                                  }>
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  disabled={
                                    busy || index === group.items.length - 1
                                  }
                                  onClick={() =>
                                    void reorder(group.items, index, 1)
                                  }>
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  onClick={() => {
                                    setEditing(item.id);
                                    setForm(formFor(item));
                                    setError(null);
                                  }}>
                                  {t("common.edit")}
                                </button>
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  onClick={() => setConfirmDelete(item)}>
                                  {t("common.delete")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {isAdmin && editing === item.id ? (
                            <form
                              className="mt-4 space-y-4 rounded-2xl bg-stone-50 p-4"
                              onSubmit={saveEdit}>
                              <AdaptationFormFields
                                form={form}
                                onChange={setForm}
                                volumes={volumes}
                                chapters={chapters}
                                volumeLocked
                              />
                              {error ? <FormError>{error}</FormError> : null}
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  onClick={() => setEditing(null)}>
                                  {t("common.cancel")}
                                </button>
                                <button
                                  disabled={busy}
                                  className={primaryButtonClassName}>
                                  {t("common.save")}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
        <ConfirmDialog
          open={isAdmin && Boolean(confirmDelete)}
          eyebrow={t("timeline.confirmEyebrow")}
          title={t("adaptations.deleteConfirmTitle")}
          description={t("adaptations.deleteConfirmBody", {
            title: confirmDelete?.title ?? "",
          })}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => void deleteConfirmed()}
          onCancel={() => setConfirmDelete(null)}
          busy={busy}
          danger
        />
        <ModalDialog
          open={Boolean(chapterDialogAdaptation)}
          onClose={() => setChapterDialogAdaptation(null)}
          labelledBy="adaptation-chapters-title"
          className={`${modalPanelClassName} max-w-lg`}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t("adaptations.field.chapters")}
              </p>
              <h3
                id="adaptation-chapters-title"
                className="mt-1 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {chapterDialogAdaptation
                  ? t("adaptations.viewAllChapters", {
                      count: chapterDialogAdaptation.adapted_chapter_ids.length,
                    })
                  : ""}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setChapterDialogAdaptation(null)}
              className={secondaryButtonClassName}>
              {t("common.close")}
            </button>
          </div>
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {chapterDialogAdaptation?.adapted_chapter_ids.map((chapterId) => {
              const chapter = chapterById.get(chapterId);
              return chapter ? (
                <li key={chapter.id}>
                  <Link
                    href={`/novels/${novelId}/volumes/${chapterDialogAdaptation.volume_id}/chapters/${chapter.id}`}
                    onClick={() => setChapterDialogAdaptation(null)}
                    className="block rounded-xl bg-stone-50 px-3 py-2 text-sm text-sky-700 ring-1 ring-stone-200/70 hover:underline">
                    {formatChapterLabel(chapter, chapterLabels)} · {chapter.title}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </ModalDialog>
        <Snackbar
          open={Boolean(snackbar)}
          tone={snackbar?.tone}
          message={snackbar?.message ?? ""}
          onClose={() => setSnackbar(null)}
          closeLabel={t("common.close")}
        />
      </div>
    </DashboardPage>
  );
}
