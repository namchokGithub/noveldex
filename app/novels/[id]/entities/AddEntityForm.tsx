"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Select } from "@/components/ui/Select";
import { normalizeEntity } from "@/libs/search/normalize";
import { useSearchMutations } from "@/libs/search/SearchIndexProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
import {
  FormError,
  fullScreenModalBackdropClassName,
  ghostButtonClassName,
  inputClassName,
  modalPanelClassName,
  primaryButtonClassName,
  smallLabelClassName,
} from "../../ui";
import { GENERIC_ENTITY_TYPES, type GenericEntityType } from "@/libs/entities/types";

export default function AddEntityForm({ novelId }: { novelId: string }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { upsert } = useSearchMutations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "location") as GenericEntityType;

    try {
      const entity = await createEntity(novelId, {
        name,
        type,
        aliases: [],
        description: "",
      });
      upsert(normalizeEntity(entity));
      setOpen(false);
      formElement.reset();
      router.push(`/novels/${novelId}/entities/${encodeURIComponent(entity.id)}`);
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={primaryButtonClassName}>
        {t("entities.add")}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className={fullScreenModalBackdropClassName}>
              <div className={`${modalPanelClassName} !max-h-none !overflow-visible`}>
                <div className="mb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                    {t("entities.addEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                    {t("entities.addTitle")}
                  </h2>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="entity-name" className={smallLabelClassName}>
                      {t("entities.name")}
                    </label>
                    <input
                      id="entity-name"
                      name="name"
                      required
                      autoFocus
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={smallLabelClassName}>{t("entities.type")}</label>
                    <Select
                      name="type"
                      defaultValue="location"
                      options={GENERIC_ENTITY_TYPES.map((type) => ({
                        value: type,
                        label: type,
                      }))}
                    />
                  </div>
                  {error ? <FormError>{error}</FormError> : null}
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
        : null}
    </>
  );
}
