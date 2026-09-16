"use client";

import Link from "next/link";
import type { Adaptation, NovelEvent } from "@/app/types";
import type { EntityRelatedChapterNote } from "@/libs/firebase/chapters";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cardClassName } from "../../../ui";
import { crossReferencePreview } from "@/libs/crossReferencePreview";

export default function EntityCrossReferences({
  novelId,
  notes,
  events,
  adaptations,
}: {
  novelId: string;
  notes: EntityRelatedChapterNote[];
  events: NovelEvent[];
  adaptations: Adaptation[];
}) {
  const { t } = useI18n();
  const notePreview = crossReferencePreview(notes);
  const eventPreview = crossReferencePreview(events);
  const adaptationPreview = crossReferencePreview(adaptations);

  if (notes.length === 0 && events.length === 0 && adaptations.length === 0)
    return null;

  return (
    <section className={cardClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
        {t("entities.relatedRecords")}
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {notes.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">{t("entities.notes")}</h2>
            <div className="mt-3 space-y-2">
              {notePreview.items.map(({ chapter, note }) => (
                <Link
                  key={`${chapter.id}-${note.id}`}
                  href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}?note=${encodeURIComponent(note.id)}`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  <p className="font-medium">{chapter.title}</p>
                  <p className="mt-1 line-clamp-2 text-stone-500">{note.content}</p>
                </Link>
              ))}
              {notePreview.remaining > 0 ? (
                <p className="px-2 py-1.5 text-sm text-stone-500">
                  {t("entities.moreNotes", { count: notePreview.remaining })}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {events.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">{t("entities.timelineEvents")}</h2>
            <div className="mt-3 space-y-2">
              {eventPreview.items.map((event) => (
                <Link
                  key={event.id}
                  href={`/novels/${novelId}/timeline`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  {event.title || t("timeline.title")}
                </Link>
              ))}
              {eventPreview.remaining > 0 ? (
                <Link
                  href={`/novels/${novelId}/timeline`}
                  className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                  {t("entities.viewTimeline", { count: eventPreview.remaining })}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {adaptations.length > 0 ? (
          <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
            <h2 className="font-semibold text-stone-900">{t("entities.adaptations")}</h2>
            <div className="mt-3 space-y-2">
              {adaptationPreview.items.map((adaptation) => (
                <Link
                  key={adaptation.id}
                  href={`/novels/${novelId}/adaptations#adaptation-${adaptation.id}`}
                  className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">
                  <span className="font-medium">{adaptation.title}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {adaptation.medium} · {adaptation.entry_type} {adaptation.entry_number}
                  </span>
                </Link>
              ))}
              {adaptationPreview.remaining > 0 ? (
                <Link
                  href={`/novels/${novelId}/adaptations`}
                  className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                  {t("entities.viewAdaptations", { count: adaptationPreview.remaining })}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
