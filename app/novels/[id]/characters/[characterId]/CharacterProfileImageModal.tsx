"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { modalPanelClassName, secondaryButtonClassName } from "../../../ui";
import ModalDialog from "@/components/a11y/ModalDialog";
import { useI18n } from "@/components/i18n/I18nProvider";

export function modalImageUrl(sourceImgUrl: string): string {
  const url = new URL(sourceImgUrl);
  if (url.searchParams.has("s")) return sourceImgUrl;
  url.searchParams.set("view", "modal");
  return url.toString();
}

export default function CharacterProfileImageModal({
  name,
  profileImageUrl,
}: {
  name: string;
  profileImageUrl: string | null;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  function openModal() {
    setImageLoaded(false);
    setImageFailed(false);
    setOpen(true);
  }

  if (!profileImageUrl || thumbnailFailed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-stone-900 text-base font-semibold text-stone-50">
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  const fullSizeImgUrl = modalImageUrl(profileImageUrl);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={t("character.viewProfileImage", { name })}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <Image
          src={profileImageUrl}
          alt=""
          width={64}
          height={64}
          onError={() => setThumbnailFailed(true)}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          unoptimized
        />
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} h-fit! w-fit! max-w-[calc(100dvw-2rem)]! overflow-hidden`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-stone-950">
            {name}
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
              {t("character.imageLoadFailed")}
            </p>
          ) : (
            <Image
              src={fullSizeImgUrl}
              alt={name}
              width={1280}
              height={1280}
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
