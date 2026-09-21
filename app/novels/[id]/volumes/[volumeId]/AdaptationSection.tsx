"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { Adaptation } from "@/app/types";
import {
  cardClassName,
  compactEmptyStateClassName,
  modalPanelClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import ModalDialog from "@/components/a11y/ModalDialog";
import { groupAdaptations } from "@/libs/adaptations/order";

function AdaptationImage({ adaptation }: { adaptation: Adaptation }) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  if (!adaptation.source_img_url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        aria-label={t("adaptations.viewImage", { title: adaptation.title })}>
        <img
          src={adaptation.source_img_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-12 w-9 rounded-lg object-contain"
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
        <img
          src={adaptation.source_img_url}
          alt={adaptation.title}
          referrerPolicy="no-referrer"
          className="max-h-[70dvh] w-full rounded-2xl object-contain"
        />
      </ModalDialog>
    </>
  );
}

export default function AdaptationSection({
  novelId,
  adaptation,
}: {
  novelId: string;
  volumeId: string;
  adaptation: Adaptation | null;
}) {
  const groups = adaptation ? groupAdaptations([adaptation]) : [];
  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-950">
          <T k="adaptations.title" />
        </h2>
        <Link
          className="text-sm font-medium text-stone-600 hover:text-stone-950"
          href={`/novels/${novelId}/adaptations`}>
          <T k="adaptations.viewAll" /> →
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className={`mt-4 ${compactEmptyStateClassName}`}>
          <T k="adaptations.empty" />
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                {group.medium} · {group.group_label}
              </p>
              {group.items.map((adaptation) => (
                <div
                  key={adaptation.id}
                  className="flex items-start gap-3 rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
                  <AdaptationImage adaptation={adaptation} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">
                      {adaptation.entry_type} {adaptation.entry_number} ·{" "}
                      {adaptation.title}
                    </p>
                    {adaptation.description ? (
                      <p className="mt-1 text-sm text-stone-500">
                        {adaptation.description}
                      </p>
                    ) : null}
                    {adaptation.source_url ? (
                      <a
                        className="mt-1 inline-block text-sm text-sky-700 hover:underline"
                        href={adaptation.source_url}
                        target="_blank"
                        rel="noreferrer">
                        <T k="adaptations.source" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
