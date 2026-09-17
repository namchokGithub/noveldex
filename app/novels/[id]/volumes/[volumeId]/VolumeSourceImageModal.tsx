"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { modalPanelClassName, secondaryButtonClassName } from "@/app/novels/ui";
import ModalDialog from "@/components/a11y/ModalDialog";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  title: string;
  sourceImgUrl: string;
};

export default function VolumeSourceImageModal({
  title,
  sourceImgUrl,
}: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("volume.viewImage", { title })}
        className="flex h-48 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-stone-100 p-2 shadow-[0_18px_36px_rgba(41,37,36,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <Image
          src={sourceImgUrl}
          alt=""
          width={320}
          height={480}
          sizes="128px"
          className="h-full w-full object-contain"
          unoptimized
        />
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} h-fit w-fit max-w-[calc(100dvw-2rem)] overflow-hidden`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-stone-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={secondaryButtonClassName}>
            {t("common.close")}
          </button>
        </div>
        <Image
          src={sourceImgUrl}
          alt={title}
          width={1280}
          height={1920}
          referrerPolicy="no-referrer"
          className="h-auto w-auto max-h-[calc(100dvh-9rem)] max-w-full rounded-2xl object-contain"
          unoptimized
        />
      </ModalDialog>
    </>
  );
}
