"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../ui";
import { createVolume, getLastOrderNos } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";

interface VolumeDraft {
  number: number;
  title: string;
}

interface SnackbarState {
  tone: "success" | "error";
  message: string;
}

export default function AddVolumeForm({ novelId }: { novelId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<VolumeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [fetchingNumber, setFetchingNumber] = useState(false);

  useEffect(() => {
    if (!snackbar) return;

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const number = Number(
      (form.elements.namedItem("number") as HTMLInputElement).value,
    );
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;

    setDraft({ number, title });
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    if (!draft) return;

    setError(null);
    setSubmitting(true);

    try {
      await createVolume(novelId, draft);
      formRef.current?.reset();
      setDraft(null);
      setConfirmOpen(false);
      setOpen(false);
      setSnackbar({
        tone: "success",
        message: t("addVolume.success"),
      });
      router.refresh();
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : t("common.networkError");

      setError(message);
      setConfirmOpen(false);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseForm() {
    setOpen(false);
    setConfirmOpen(false);
    setDraft(null);
    setError(null);
    setNextNumber(null);
  }

  async function handleOpenForm() {
    setFetchingNumber(true);
    try {
      const nos = await getLastOrderNos({ novel_id: novelId });
      setNextNumber(nos.volume + 1);
    } catch {
      setNextNumber(null); // silent fallback — user types manually
    } finally {
      setFetchingNumber(false);
      setOpen(true);
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={handleOpenForm}
          disabled={fetchingNumber}
          className={primaryButtonClassName}>
          {fetchingNumber ? t("common.loading") : t("addVolume.button")}
        </button>
      ) : (
        <div className={modalBackdropClassName}>
          <div className={modalPanelClassName}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t("addVolume.eyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {t("addVolume.title")}
              </h2>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="flex flex-col gap-3">
              <div>
                <label className={smallLabelClassName}>
                  {t("addVolume.numberRequired")}
                </label>
                <input
                  name="number"
                  type="number"
                  min={1}
                  required
                  className={inputClassName}
                  defaultValue={nextNumber ?? undefined}
                  placeholder="1"
                />
              </div>
              <div>
                <label className={smallLabelClassName}>
                  {t("common.titleRequired")}
                </label>
                <input
                  name="title"
                  required
                  className={inputClassName}
                  placeholder={t("addVolume.titlePlaceholder")}
                />
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className={ghostButtonClassName}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={primaryButtonClassName}>
                  {submitting ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmOpen ? (
        <div className={`${modalBackdropClassName} z-60`}>
          <div className={`${modalPanelClassName} max-w-sm`}>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t("addVolume.confirmEyebrow")}
              </p>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-stone-950">
                {t("addVolume.confirmTitle")}
              </h3>
              <p className="text-sm leading-6 text-stone-600">
                {t("addVolume.confirmBody", {
                  number: draft?.number ?? "",
                  title: draft?.title ?? "",
                })}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className={secondaryButtonClassName}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSave}
                className={primaryButtonClassName}>
                {submitting ? t("common.saving") : t("addVolume.confirmAction")}
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
    </>
  );
}
