"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PaginationMeta, Volume } from "@/app/types";

import {
  emptyStateClassName,
  dangerIconButtonClassName,
  ghostButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../ui";
import ConfirmDialog from "../ConfirmDialog";
import { deleteVolume, updateVolume } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useResetOnSignOut } from "@/components/auth/useResetOnSignOut";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { normalizeVolume } from "@/libs/search/normalize";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { descendantsOf } from "@/libs/search/cascadeDelete";
import { canNavigatePage } from "@/libs/pagination";
import { localizedVolumeTitle } from "@/libs/volumeTitle";

interface VolumeItem extends Volume {
  chapterCount: number;
}

interface ConfirmState {
  action: "save" | "delete";
  volumeId: string;
  title: string;
  number: number;
}

interface SnackbarState {
  tone: "success" | "error";
  message: string;
}

export default function VolumeManager({
  novelId,
  volumes,
  pagination,
}: {
  novelId: string;
  volumes: VolumeItem[];
  pagination: PaginationMeta;
}) {
  const { t, language } = useI18n();
  const { documents, discardMany, upsert } = useSearchIndex();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleTh, setTitleTh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  useResetOnSignOut(isAdmin, () => {
    setEditingId(null);
    setConfirmState(null);
  });

  function buildPageHref(page: number, perPage = pagination.per_page) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    return `${pathname}?${params.toString()}`;
  }

  function handlePerPageChange(nextPerPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("per_page", String(nextPerPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  const canGoPrevious = canNavigatePage(
    pagination.page,
    pagination.total_pages,
    "previous",
  );
  const canGoNext = canNavigatePage(
    pagination.page,
    pagination.total_pages,
    "next",
  );

  useEffect(() => {
    if (!snackbar) return;

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  function startEdit(volume: VolumeItem) {
    setEditingId(volume.id);
    setNumber(String(volume.number));
    setTitleEn(volume.title_en ?? volume.title);
    setTitleTh(volume.title_th ?? "");
    setError(null);
  }

  function requestSave(volume: VolumeItem) {
    setError(null);
    setConfirmState({
      action: "save",
      volumeId: volume.id,
      title: localizedVolumeTitle(
        { title: titleEn, title_en: titleEn, title_th: titleTh },
        language,
      ),
      number: Number(number),
    });
  }

  async function handleSave(volumeId: string) {
    setSaving(true);
    setError(null);

    try {
      const updated = await updateVolume(novelId, volumeId, {
        number: Number(number),
        title_en: titleEn,
        title_th: titleTh,
      });
      upsert(normalizeVolume(updated));
      setConfirmState(null);
      setEditingId(null);
      setSnackbar({
        tone: "success",
        message: t("volumeManager.saveSuccess"),
      });
      router.refresh();
    } catch (nextError) {
      const message = userErrorMessage(nextError, t);

      setError(message);
      setConfirmState(null);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(volume: VolumeItem) {
    setConfirmState({
      action: "delete",
      volumeId: volume.id,
      title: localizedVolumeTitle(volume, language),
      number: volume.number,
    });
  }

  async function handleDelete(volume: VolumeItem) {
    setDeletingId(volume.id);
    setError(null);

    try {
      await deleteVolume(novelId, volume.id);
      discardMany(
        descendantsOf(
          { type: "volume", novelId, volumeId: volume.id },
          documents,
        ),
      );
      setConfirmState(null);
      setSnackbar({
        tone: "success",
        message: t("volumeManager.deleteSuccess"),
      });
      router.refresh();
    } catch (nextError) {
      const message = userErrorMessage(nextError, t);

      setError(message);
      setConfirmState(null);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleConfirmAction() {
    if (!confirmState) return;

    if (confirmState.action === "save") {
      void handleSave(confirmState.volumeId);
      return;
    }

    const volume = volumes.find((item) => item.id === confirmState.volumeId);
    if (!volume) {
      const message = t("volumeManager.notFound");
      setError(message);
      setConfirmState(null);
      setSnackbar({
        tone: "error",
        message,
      });
      return;
    }

    void handleDelete(volume);
  }

  if (volumes.length === 0) {
    return (
      <div className={emptyStateClassName}>
        <p>{t("volumeManager.empty")}</p>
      </div>
    );
  }

  return (
    <div className={`${listClassName} flex h-full flex-col`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          {t("common.showing", {
            start: (pagination.page - 1) * pagination.per_page + 1,
            end: Math.min(
              pagination.page * pagination.per_page,
              pagination.total_items,
            ),
            total: pagination.total_items,
          })}
        </p>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          {t("common.perPage")}
          <select
            value={pagination.per_page}
            onChange={(event) =>
              handlePerPageChange(Number(event.target.value))
            }
            className={`${inputClassName} min-w-20 py-2`}>
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden border-b border-stone-200 bg-stone-50/70 px-4 py-3 sm:block">
        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
          <p>{t("volume.label")}</p>
          <p className="text-right">{t("common.actions")}</p>
        </div>
      </div>

      <div className="lg:h-[535px] lg:overflow-y-auto">
        <ul className="divide-y divide-stone-200">
          {volumes.map((volume) => (
            <li key={volume.id} className="px-4 py-4">
              {editingId === volume.id ? (
                <div className="space-y-3 rounded-2xl bg-stone-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={smallLabelClassName}>
                        {t("addVolume.numberRequired")}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={number}
                        onChange={(event) => setNumber(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={smallLabelClassName}>
                        {t("addChapter.titleEnglishRequired")}
                      </label>
                      <input
                        value={titleEn}
                        onChange={(event) => setTitleEn(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={smallLabelClassName}>
                        {t("addChapter.titleThaiOptional")}
                      </label>
                      <input
                        value={titleTh}
                        onChange={(event) => setTitleTh(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  {error ? (
                    <p className="text-sm text-rose-600">{error}</p>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                      className={secondaryButtonClassName}>
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestSave(volume)}
                      disabled={saving || !titleEn.trim()}
                      className={primaryButtonClassName}>
                      {saving ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={listRowClassName}>
                  <Link
                    href={`/novels/${novelId}/volumes/${volume.id}`}
                    prefetch={false}
                    className="min-w-0 flex-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2">
                    <div className="text-base font-semibold text-stone-900 transition hover:text-stone-700">
                      {t("volumeManager.volumeLabel", {
                        number: volume.number,
                      })}{" "}
                      · {localizedVolumeTitle(volume, language)}
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {t(
                        volume.chapterCount === 1
                          ? "volumeManager.chapter.one"
                          : "volumeManager.chapter.other",
                        { count: volume.chapterCount },
                      )}
                    </p>
                  </Link>
                  {isAdmin ? (
                    <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => startEdit(volume)}
                        className={ghostButtonClassName}
                        aria-label={t("volumeManager.editAria")}>
                        {t("volumeManager.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(volume)}
                        disabled={deletingId === volume.id}
                        className={dangerIconButtonClassName}
                        aria-label={t("volumeManager.deleteAria")}>
                        {t("common.delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-0 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 lg:mt-auto">
        <p className="text-sm text-stone-500">
          {t("common.pageOf", {
            page: pagination.page,
            total: pagination.total_pages,
          })}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() =>
              router.push(buildPageHref(Math.max(1, pagination.page - 1)))
            }
            className={secondaryButtonClassName}>
            {t("common.previous")}
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() =>
              router.push(
                buildPageHref(
                  Math.min(pagination.total_pages, pagination.page + 1),
                ),
              )
            }
            className={secondaryButtonClassName}>
            {t("common.next")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState?.action === "save"}
        eyebrow={t("volumeManager.confirmEyebrow")}
        title={t("volumeManager.saveConfirmTitle")}
        description={t("volumeManager.saveConfirmBody", {
          number: confirmState?.number ?? 0,
          title: confirmState?.title ?? "",
        })}
        confirmLabel={
          saving ? t("common.saving") : t("addVolume.confirmAction")
        }
        cancelLabel={t("common.cancel")}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
        busy={saving}
      />

      <ConfirmDialog
        open={confirmState?.action === "delete"}
        eyebrow={t("volumeManager.confirmEyebrow")}
        title={t("volumeManager.deleteConfirmTitle")}
        description={t("volumeManager.deleteConfirmBody", {
          title: confirmState?.title ?? "",
        })}
        confirmLabel={
          deletingId ? t("volumeManager.deleting") : t("common.delete")
        }
        cancelLabel={t("common.cancel")}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
        busy={deletingId !== null}
        danger
      />

      {snackbar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-70 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex min-w-70 max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(28,25,23,0.18)] ${
              snackbar.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}>
            <p className="text-sm font-medium">{snackbar.message}</p>
            <button
              type="button"
              onClick={() => setSnackbar(null)}
              className="rounded-full px-2 py-1 text-xs font-semibold text-current/70 transition hover:bg-black/5 hover:text-current">
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
