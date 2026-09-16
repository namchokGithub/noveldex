"use client";

import { useId, useState } from "react";
import Image from "next/image";
import NovelCover from "../NovelCover";
import { modalPanelClassName, secondaryButtonClassName } from "../ui";
import ModalDialog from "@/components/a11y/ModalDialog";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  title: string;
  coverUrl?: string | null;
};

export default function NovelCoverModal({ title, coverUrl }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);

  if (!coverUrl) {
    return (
      <NovelCover
        title={title}
        coverUrl={coverUrl}
        alt={title}
        className="h-40 w-28 rounded-3xl object-cover shadow-[0_18px_36px_rgba(41,37,36,0.18)] sm:h-44 sm:w-32"
        fallbackClassName="relative shadow-[0_18px_36px_rgba(41,37,36,0.22)]"
        titleClassName="text-2xl"
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("novel.viewCover", { title })}
        className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <NovelCover
          title={title}
          coverUrl={coverUrl}
          alt=""
          className="h-40 w-28 rounded-3xl object-cover shadow-[0_18px_36px_rgba(41,37,36,0.18)] sm:h-44 sm:w-32"
        />
      </button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className={`${modalPanelClassName} h-fit w-fit max-w-[calc(100dvw-2rem)] overflow-hidden`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-stone-950">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={secondaryButtonClassName}>
            {t("common.close")}
          </button>
        </div>
        <Image
          src={coverUrl}
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
