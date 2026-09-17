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

export function modalImageUrl(sourceImgUrl: string): string {
  const url = new URL(sourceImgUrl);
  url.searchParams.set("view", "modal");
  return url.toString();
}

export default function VolumeSourceImageModal({ title, sourceImgUrl }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const fullSizeImgUrl = modalImageUrl(sourceImgUrl);

  function openModal() {
    setImageLoaded(false);
    setImageFailed(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={t("volume.viewImage", { title })}
        className="flex h-48 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-stone-100 p-2 shadow-[0_18px_36px_rgba(41,37,36,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <Image
          src={sourceImgUrl}
          alt=""
          width={320}
          height={480}
          sizes="128px"
          className="h-full w-full object-contain"
          referrerPolicy="no-referrer"
        />
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} h-fit! w-fit! max-w-[calc(100dvw-2rem)]! overflow-hidden`}>
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
        <div className="relative">
          {!imageLoaded && !imageFailed ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse rounded-2xl bg-stone-200"
            />
          ) : null}
          {imageFailed ? (
            <p
              role="alert"
              className="flex h-[75dvh] min-h-60 min-w-60 items-center justify-center rounded-2xl bg-stone-100 px-6 text-center text-sm text-stone-500">
              {t("volume.imageLoadFailed")}
            </p>
          ) : (
            <Image
              src={fullSizeImgUrl}
              alt={title}
              width={1280}
              height={1920}
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              unoptimized
              className={`h-[75dvh] w-auto max-h-[calc(100dvh-9rem)] max-w-[calc(100dvw-4rem)] rounded-2xl object-contain transition-opacity duration-200 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>
      </ModalDialog>
    </>
  );
}
