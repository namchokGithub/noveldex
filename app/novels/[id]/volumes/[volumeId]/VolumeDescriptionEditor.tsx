"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cardClassName,
  FormError,
  primaryButtonClassName,
  secondaryButtonClassName,
  Snackbar,
  smallLabelClassName,
  textareaClassName,
} from "@/app/novels/ui";
import { useI18n } from "@/components/i18n/I18nProvider";
import { updateVolume } from "@/libs/api";
import { userErrorMessage } from "@/libs/userErrorMessage";

const MAX_DESCRIPTION_LENGTH = 500;

export default function VolumeDescriptionEditor({
  novelId,
  volumeId,
  initialDescription,
}: {
  novelId: string;
  volumeId: string;
  initialDescription: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription);
  const [savedDescription, setSavedDescription] = useState(initialDescription);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  async function saveDescription() {
    setError(null);
    setSaving(true);
    try {
      await updateVolume(novelId, volumeId, { description });
      setSavedDescription(description);
      setEditing(false);
      setSnackbar({ tone: "success", message: t("volume.descriptionSaved") });
      router.refresh();
    } catch (cause) {
      const message = userErrorMessage(cause, t);
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <label className={smallLabelClassName}>{t("common.description")}</label>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClassName}>
            {t("common.edit")}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={4}
            className={textareaClassName}
            placeholder={t("volume.descriptionPlaceholder")}
          />
          <div className="mt-1 flex justify-end">
            <p className="text-xs text-stone-400">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>
          {error && <FormError>{error}</FormError>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setDescription(savedDescription); setError(null); setEditing(false); }} disabled={saving} className={secondaryButtonClassName}>
              {t("common.cancel")}
            </button>
            <button type="button" onClick={() => void saveDescription()} disabled={saving} className={primaryButtonClassName}>
              {saving ? t("common.saving") : t("volume.saveDescription")}
            </button>
          </div>
        </>
      ) : (
        <p className={`whitespace-pre-wrap break-words text-sm leading-7 ${savedDescription ? "text-stone-700" : "italic text-stone-400"}`}>
          {savedDescription || t("novels.noDescription")}
        </p>
      )}
      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </div>
  );
}
