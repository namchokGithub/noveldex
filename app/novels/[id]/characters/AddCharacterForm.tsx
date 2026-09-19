"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { CharacterRole } from "@/app/types";
import {
  ghostButtonClassName,
  inputClassName,
  fullScreenModalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  Snackbar,
  smallLabelClassName,
} from "../../ui";
import { useI18n } from "@/components/i18n/I18nProvider";
import { createCharacter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { Select } from "@/components/ui/Select";

export default function AddCharacterForm({
  novelId,
  roles,
}: {
  novelId: string;
  roles: CharacterRole[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  const defaultRoleId = roles[0]?.id ?? "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const aliasesRaw = (form.elements.namedItem("aliases") as HTMLInputElement)
      .value;
    const profileImageUrl = (
      form.elements.namedItem("profile_image_url") as HTMLInputElement
    ).value.trim();
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      role_id: (form.elements.namedItem("role_id") as HTMLSelectElement).value,
      description: (
        form.elements.namedItem("description") as HTMLTextAreaElement
      ).value,
      aliases: aliasesRaw
        ? aliasesRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      ...(profileImageUrl ? { profile_image_url: profileImageUrl } : {}),
    };

    try {
      await createCharacter(novelId, data);

      form.reset();
      setOpen(false);
      setSnackbar({ tone: "success", message: t("addCharacter.success") });
      router.refresh();
    } catch {
      const message = t("common.networkError");
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={primaryButtonClassName}>
          {t("addCharacter.button")}
        </button>
      ) : typeof document !== "undefined" ? (
        createPortal(
        <div className={fullScreenModalBackdropClassName}>
          <div className={modalPanelClassName}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t("addCharacter.eyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {t("addCharacter.title")}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className={smallLabelClassName}>
                  {t("addCharacter.nameRequired")}
                </label>
                <input
                  name="name"
                  required
                  className={inputClassName}
                  placeholder={t("addCharacter.namePlaceholder")}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>
                  {t("addCharacter.role")}
                </label>
                <Select
                  name="role_id"
                  defaultValue={defaultRoleId}
                  options={roles.map((role) => ({ value: role.id, label: role.name }))}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>
                  {t("addCharacter.aliases")}
                </label>
                <input
                  name="aliases"
                  className={inputClassName}
                  placeholder={t("addCharacter.aliasesPlaceholder")}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>
                  {t("addCharacter.profileImageUrl")}
                </label>
                <input
                  name="profile_image_url"
                  type="url"
                  className={inputClassName}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className={smallLabelClassName}>
                  {t("common.description")}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className={inputClassName}
                  placeholder={t("addCharacter.descriptionPlaceholder")}
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="mt-1 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
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
        </div>,
        document.body,
        )
      ) : null}

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </>
  );
}
