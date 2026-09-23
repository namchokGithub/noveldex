"use client";

import { useId, useState } from "react";
import Image from "next/image";
import type { Adaptation } from "@/app/types";
import { modalPanelClassName, secondaryButtonClassName } from "@/app/novels/ui";
import ModalDialog from "@/components/a11y/ModalDialog";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function AdaptationImageModal({
  adaptation,
}: {
  adaptation: Adaptation;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  if (!adaptation.source_img_url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        aria-label={t("adaptations.viewImage", { title: adaptation.title })}>
        <Image
          src={adaptation.source_img_url}
          alt=""
          width={48}
          height={64}
          sizes="48px"
          referrerPolicy="no-referrer"
          className="h-16 w-12 rounded-xl object-contain"
        />
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} max-w-4xl`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-stone-950">
            {adaptation.title}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={secondaryButtonClassName}>
            {t("common.close")}
          </button>
        </div>
        <Image
          src={adaptation.source_img_url}
          alt={adaptation.title}
          width={1600}
          height={1200}
          sizes="(max-width: 1024px) 100vw, 896px"
          referrerPolicy="no-referrer"
          className="h-auto max-h-[70dvh] w-full rounded-2xl object-contain"
          unoptimized
        />
      </ModalDialog>
    </>
  );
}
