"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Adaptation,
  AdaptationEntryType,
  AdaptationMedium,
} from "@/app/types";
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  FormError,
  ghostButtonClassName,
  inputClassName,
  primaryButtonClassName,
  SectionHeading,
  Snackbar,
  smallLabelClassName,
} from "@/app/novels/ui";
import ConfirmDialog from "@/app/novels/ConfirmDialog";
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
import { localizedVolumeTitle } from "@/libs/volumeTitle";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { normalizeAdaptation } from "@/libs/search/normalize";
import AdaptationFormFields, {
  type AdaptationFormState,
} from "./AdaptationFormFields";

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
});

export default function AdaptationTimeline({
  novelId,
  novelTitle,
  volumes,
  initialAdaptations,
}: {
  novelId: string;
  novelTitle: string;
  volumes: VolumeSearchSource[];
  initialAdaptations: Adaptation[];
}) {
  const { t, language } = useI18n();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { upsert, discard } = useSearchIndex();
  const volumeById = useMemo(
    () => new Map(volumes.map((volume) => [volume.id, volume])),
    [volumes],
  );
  const [items, setItems] = useState(initialAdaptations);
  const [volumeFilter, setVolumeFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(() => emptyForm(volumes[0]?.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Adaptation | null>(null);
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
    setForm((current) =>
      current.group_label !== next.group_label ||
      current.group_sort_order !== next.group_sort_order ||
      current.medium !== next.medium ||
      current.volume_id !== next.volume_id
        ? nextSortOrder(next)
        : next,
    );
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
      upsert(normalizeAdaptation(saved, volumeById.get(saved.volume_id)));
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
      upsert(normalizeAdaptation(saved, volumeById.get(saved.volume_id)));
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
          <select
            className={inputClassName}
            value={volumeFilter}
            onChange={(event) => setVolumeFilter(event.target.value)}>
            <option value="all">{t("adaptations.allVolumes")}</option>
            {volumes.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {t("adaptations.volume")} {volume.number} ·{" "}
                {localizedVolumeTitle(volume, language)}
              </option>
            ))}
          </select>
        </label>
        {showAdd && isAdmin ? (
          <form className={`${cardClassName} space-y-4`} onSubmit={saveAdd}>
            <h2 className="font-semibold">{t("adaptations.addTitle")}</h2>
            <AdaptationFormFields
              form={form}
              onChange={setAddForm}
              volumes={volumes}
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
                            <div>
                              <p className="font-medium text-stone-900">
                                {item.entry_type} {item.entry_number} ·{" "}
                                {item.title}
                              </p>
                              {item.description ? (
                                <p className="mt-2 text-sm text-stone-600">
                                  {item.description}
                                </p>
                              ) : null}
                              {item.source_url ? (
                                <a
                                  className="mt-2 inline-block text-sm text-sky-700 hover:underline"
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noreferrer">
                                  {t("adaptations.source")}
                                </a>
                              ) : null}
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
