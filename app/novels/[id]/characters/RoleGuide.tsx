"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import ModalDialog from "@/components/a11y/ModalDialog";
import {
  modalPanelClassName,
  roleColorClassNames,
  secondaryButtonClassName,
} from "../../ui";

const roles = [
  "main",
  "protagonist",
  "antagonist",
  "supporting",
  "minor",
] as const;

export default function RoleGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("characters.roleGuide")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-sm font-semibold text-stone-500 transition hover:border-stone-500 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        i
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} max-w-3xl!`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-stone-950">
              {t("characters.roleGuide")}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t("characters.roleGuideIntro")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
            className={`${secondaryButtonClassName} px-3 py-1.5 text-xs`}>
            {t("common.close")}
          </button>
        </div>
        <div className="mt-5 space-y-5 font-sans text-sm font-normal leading-7 tracking-normal text-stone-700">
          {roles.map((role) => (
            <div key={role} className="space-y-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleColorClassNames[role] ?? roleColorClassNames.minor}`}>
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current"
                  aria-hidden="true"
                />
                {t(`characters.role.${role}.name`)}
              </span>
              <p className="mt-1 text-sm font-normal leading-6 text-stone-500">
                {t(`characters.role.${role}.summary`)}
              </p>
              <p className="mt-1 text-sm font-normal leading-7 text-stone-700">
                {t(`characters.role.${role}.description`)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-stone-200 pt-4 text-xs text-stone-400">
          {t("characters.roleGuideFooter")}
        </p>
      </ModalDialog>
    </>
  );
}
