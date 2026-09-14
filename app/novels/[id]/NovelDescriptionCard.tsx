"use client";

import { useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { modalPanelClassName, secondaryButtonClassName } from "../ui";

export default function NovelDescriptionCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <div className={`relative ${className}`}>
        {children}
        {description && (
          <button
            type="button"
            aria-label={`${t("common.readFull")}: ${title}`}
            aria-haspopup="dialog"
            onClick={() => dialogRef.current?.showModal()}
            className="absolute inset-0 cursor-pointer rounded-[22px] transition hover:bg-stone-900/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
          />
        )}
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className={`${modalPanelClassName} fixed inset-0 m-auto max-h-[85dvh] max-w-2xl overflow-y-auto p-0 backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm`}
        style={{ width: "calc(100% - 2rem)" }}>
        <div className="p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2
              id={titleId}
              className="text-xl font-semibold tracking-tight text-stone-950">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${secondaryButtonClassName} shrink-0`}>
              {t("common.close")}
            </button>
          </div>
          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-stone-600 sm:text-base">
            {description}
          </p>
        </div>
      </dialog>
    </>
  );
}
