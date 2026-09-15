import Link from "next/link";
import type { Adaptation, Chapter, NovelEvent } from "@/app/types";
import { cardClassName } from "@/app/novels/ui";
import { T } from "@/components/i18n/I18nProvider";
import { crossReferencePreview } from "@/libs/crossReferencePreview";

type LinkedEntity = {
  id: string;
  label: string;
  type: string;
};

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
  const entities = linkedEntities(chapter);
  const eventPreview = crossReferencePreview(events);
  const adaptationPreview = crossReferencePreview(adaptations);
  if (entities.length === 0 && events.length === 0 && adaptations.length === 0)
    return null;

  return (
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
              {entities.map((entity) => (
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
                <Link
                  href={`/novels/${novelId}/timeline`}
                  className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                  <T
                    k="chapter.viewTimeline"
                    values={{ count: eventPreview.remaining }}
                  />
                </Link>
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
                <Link
                  href={`/novels/${novelId}/adaptations`}
                  className="block px-2 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-950">
                  <T
                    k="chapter.viewAdaptations"
                    values={{ count: adaptationPreview.remaining }}
                  />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
