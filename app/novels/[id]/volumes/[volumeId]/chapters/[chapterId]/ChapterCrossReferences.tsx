"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Adaptation, Chapter, NovelEvent } from "@/app/types";
import {
  cardClassName,
  modalPanelClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import ModalDialog from "@/components/a11y/ModalDialog";
import { crossReferencePreview } from "@/libs/crossReferencePreview";

type LinkedEntity = {
  id: string;
  label: string;
  type: string;
};

type RelatedList = "entities" | "events" | "adaptations";

function linkedEntities(chapter: Chapter): LinkedEntity[] {
  const entities = new Map<string, LinkedEntity>();
  for (const note of chapter.notes) {
    for (const occurrence of note.references ?? []) {
      if (
        occurrence.token.status !== "resolved" ||
        occurrence.token.reference.entityType === "character"
      )
        continue;
      const reference = occurrence.token.reference;
      entities.set(reference.entityId, {
        id: reference.entityId,
        label: reference.label,
        type: reference.entityType,
      });
    }
  }
  return [...entities.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export default function ChapterCrossReferences({
  novelId,
  chapter,
  events,
  adaptations,
}: {
  novelId: string;
  chapter: Chapter;
  events: NovelEvent[];
  adaptations: Adaptation[];
}) {
  const { t } = useI18n();
  const modalTitleId = useId();
  const [activeList, setActiveList] = useState<RelatedList | null>(null);
  const entities = linkedEntities(chapter);
  const entityPreview = crossReferencePreview(entities);
  const eventPreview = crossReferencePreview(events);
  const adaptationPreview = crossReferencePreview(adaptations);
  if (entities.length === 0 && events.length === 0 && adaptations.length === 0)
    return null;

  const activeTitle =
    activeList === "entities"
      ? t("chapter.linkedEntities")
      : activeList === "events"
        ? t("chapter.timelineEvents")
        : t("chapter.adaptationLinks");

  return (
    <>
      <section className={cardClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
        <T k="chapter.related" />
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {entities.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">
              <T k="chapter.linkedEntities" />
            </h2>
            <div className="mt-3 space-y-2">
              {entityPreview.items.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/novels/${novelId}/entities/${encodeURIComponent(entity.id)}`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  <span className="font-medium">{entity.label}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {entity.type}
                  </span>
                </Link>
              ))}
              {entityPreview.remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveList("entities")}
                  aria-label={`Show ${entityPreview.remaining} more ${t("chapter.linkedEntities")}`}
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950">
                  +{entityPreview.remaining}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {events.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">
              <T k="chapter.timelineEvents" />
            </h2>
            <div className="mt-3 space-y-2">
              {eventPreview.items.map((event) => (
                <Link
                  key={event.id}
                  href={`/novels/${novelId}/timeline`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  {event.title || <T k="timeline.title" />}
                </Link>
              ))}
              {eventPreview.remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveList("events")}
                  aria-label={`Show ${eventPreview.remaining} more ${t("chapter.timelineEvents")}`}
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950">
                  +{eventPreview.remaining}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {adaptations.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">
              <T k="chapter.adaptationLinks" />
            </h2>
            <div className="mt-3 space-y-2">
              {adaptationPreview.items.map((adaptation) => (
                <Link
                  key={adaptation.id}
                  href={`/novels/${novelId}/adaptations#adaptation-${adaptation.id}`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  <span className="font-medium">{adaptation.title}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {adaptation.medium} · {adaptation.entry_type}{" "}
                    {adaptation.entry_number}
                  </span>
                </Link>
              ))}
              {adaptationPreview.remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveList("adaptations")}
                  aria-label={`Show ${adaptationPreview.remaining} more ${t("chapter.adaptationLinks")}`}
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950">
                  +{adaptationPreview.remaining}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      </section>
      <ModalDialog
        open={activeList !== null}
        onClose={() => setActiveList(null)}
        labelledBy={modalTitleId}
        className={`${modalPanelClassName} max-w-lg`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
              <T k="chapter.related" />
            </p>
            <h3
              id={modalTitleId}
              className="mt-1 text-xl font-semibold tracking-[-0.03em] text-stone-950">
              {activeTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveList(null)}
            className={secondaryButtonClassName}>
            {t("common.cancel")}
          </button>
        </div>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {activeList === "entities"
            ? entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/novels/${novelId}/entities/${encodeURIComponent(entity.id)}`}
                  onClick={() => setActiveList(null)}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
                  <span className="font-medium">{entity.label}</span>
                  <span className="ml-2 text-xs text-stone-400">{entity.type}</span>
                </Link>
              ))
            : null}
          {activeList === "events"
            ? events.map((event) => (
                <Link
                  key={event.id}
                  href={`/novels/${novelId}/timeline`}
                  onClick={() => setActiveList(null)}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
                  {event.title || <T k="timeline.title" />}
                </Link>
              ))
            : null}
          {activeList === "adaptations"
            ? adaptations.map((adaptation) => (
                <Link
                  key={adaptation.id}
                  href={`/novels/${novelId}/adaptations#adaptation-${adaptation.id}`}
                  onClick={() => setActiveList(null)}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
                  <span className="font-medium">{adaptation.title}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {adaptation.medium} · {adaptation.entry_type} {adaptation.entry_number}
                  </span>
                </Link>
              ))
            : null}
        </div>
      </ModalDialog>
    </>
  );
}
