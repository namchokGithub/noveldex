"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PaginationMeta, Volume } from "@/app/types";

import {
  cardClassName,
  ghostButtonClassName,
  iconButtonClassName,
  inputClassName,
  listClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../ui";
import { deleteVolume, updateVolume } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

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
    setTitle(volume.title);
    setError(null);
  }

  function requestSave(volume: VolumeItem) {
    setError(null);
    setConfirmState({
      action: "save",
      volumeId: volume.id,
      title,
      number: Number(number),
    });
  }

  async function handleSave(volumeId: string) {
    setSaving(true);
    setError(null);

    try {
      await updateVolume(novelId, volumeId, {
        number: Number(number),
        title,
      });
      setConfirmState(null);
      setEditingId(null);
      setSnackbar({
        tone: "success",
        message: t("volumeManager.saveSuccess"),
      });
      router.refresh();
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : t("common.networkError");

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
      title: volume.title,
      number: volume.number,
    });
  }

  async function handleDelete(volume: VolumeItem) {
    setDeletingId(volume.id);
    setError(null);

    try {
      await deleteVolume(novelId, volume.id);
      setConfirmState(null);
      setSnackbar({
        tone: "success",
        message: t("volumeManager.deleteSuccess"),
      });
      router.refresh();
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : t("common.networkError");

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
      <div className={cardClassName}>
        <p className="text-sm text-stone-500">
          {t("volumeManager.empty")}
          ![1779811058926](image/VolumeManager/1779811058926.png)![1779811063412](image/VolumeManager/1779811063412.png)
        </p>
      </div>
    );
  }

  return (
    <div className={listClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          Showing {(pagination.page - 1) * pagination.per_page + 1}-
          {Math.min(
            pagination.page * pagination.per_page,
            pagination.total_items,
          )}{" "}
          of {pagination.total_items}
        </p>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          Per page
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

      <div className="border-b border-stone-200 bg-stone-50/70 px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
          <p>Volume</p>
          <p className="text-right">Actions</p>
        </div>
      </div>

      <div className="max-h-105 overflow-y-auto">
        <ul className="divide-y divide-stone-200">
          {volumes.map((volume) => (
            <li key={volume.id} className="px-4 py-4">
              {editingId === volume.id ? (
                <div className="space-y-3 rounded-2xl bg-stone-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
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
                        {t("common.titleRequired")}
                      </label>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  {error ? (
                    <p className="text-sm text-rose-600">{error}</p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={secondaryButtonClassName}>
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestSave(volume)}
                      disabled={saving}
                      className={primaryButtonClassName}>
                      {saving ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_220px] items-center gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/novels/${novelId}/volumes/${volume.id}`}
                      prefetch={false}
                      className="text-base font-semibold text-stone-900 hover:text-stone-700">
                      {t("volumeManager.volumeLabel", {
                        number: volume.number,
                      })}{" "}
                      · {volume.title}
                    </Link>
                    <p className="mt-1 text-sm text-stone-500">
                      {t(
                        volume.chapterCount === 1
                          ? "volumeManager.chapter.one"
                          : "volumeManager.chapter.other",
                        { count: volume.chapterCount },
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/novels/${novelId}/volumes/${volume.id}`}
                      prefetch={false}
                      className={ghostButtonClassName}>
                      {t("volumeManager.open")}
                    </Link>
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
                      className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
                      aria-label={t("volumeManager.deleteAria")}>
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-500">
          Page {pagination.page} of {pagination.total_pages}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildPageHref(Math.max(1, pagination.page - 1))}
            prefetch={false}
            aria-disabled={pagination.page <= 1}
            className={`${secondaryButtonClassName} ${
              pagination.page <= 1 ? "pointer-events-none opacity-50" : ""
            }`}>
            Prev
          </Link>
          <Link
            href={buildPageHref(
              Math.min(pagination.total_pages, pagination.page + 1),
            )}
            prefetch={false}
            aria-disabled={pagination.page >= pagination.total_pages}
            className={`${secondaryButtonClassName} ${
              pagination.page >= pagination.total_pages
                ? "pointer-events-none opacity-50"
                : ""
            }`}>
            Next
          </Link>
        </div>
      </div>

      {confirmState ? (
        <div className={`${modalBackdropClassName} z-60`}>
          <div className={`${modalPanelClassName} max-w-sm`}>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t("volumeManager.confirmEyebrow")}
              </p>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-stone-950">
                {confirmState.action === "save"
                  ? t("volumeManager.saveConfirmTitle")
                  : t("volumeManager.deleteConfirmTitle")}
              </h3>
              <p className="text-sm leading-6 text-stone-600">
                {confirmState.action === "save"
                  ? t("volumeManager.saveConfirmBody", {
                      number: confirmState.number,
                      title: confirmState.title,
                    })
                  : t("volumeManager.deleteConfirmBody", {
                      title: confirmState.title,
                    })}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving || deletingId !== null}
                onClick={() => setConfirmState(null)}
                className={secondaryButtonClassName}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={saving || deletingId !== null}
                onClick={handleConfirmAction}
                className={
                  confirmState.action === "save"
                    ? primaryButtonClassName
                    : `${primaryButtonClassName} bg-rose-600 hover:bg-rose-500`
                }>
                {confirmState.action === "save"
                  ? saving
                    ? t("common.saving")
                    : t("addVolume.confirmAction")
                  : deletingId !== null
                    ? t("volumeManager.deleting")
                    : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
