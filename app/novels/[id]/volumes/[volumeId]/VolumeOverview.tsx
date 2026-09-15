import Link from "next/link";
import type { Adaptation, Chapter, NovelEvent } from "@/app/types";
import { cardClassName } from "@/app/novels/ui";
import { T } from "@/components/i18n/I18nProvider";
import { summarizeVolumeContents } from "@/libs/volumeSummary";

function SummaryCard({
  label,
  count,
  href,
}: {
  label: React.ReactNode;
  count: number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400 sm:text-[11px] sm:tracking-[0.22em]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-stone-900 sm:mt-2 sm:text-2xl">
        {count}
      </p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/70 transition hover:bg-white hover:ring-stone-300 sm:px-4 sm:py-3">
      {content}
    </Link>
  ) : (
    <div className="rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/70 sm:px-4 sm:py-3">
      {content}
    </div>
  );
}

export default function VolumeOverview({
  novelId,
  chapters,
  events,
  adaptations,
}: {
  novelId: string;
  chapters: Chapter[];
  events: NovelEvent[];
  adaptations: Adaptation[];
}) {
  const summary = summarizeVolumeContents({
    chapters,
    eventCount: events.length,
    adaptationCount: adaptations.length,
  });
  return (
    <section className={cardClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
        <T k="volume.overview" />
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard label={<T k="volume.chapters" />} count={summary.chapters} />
        <SummaryCard label={<T k="volume.notes" />} count={summary.notes} />
        <SummaryCard
          label={<T k="volume.events" />}
          count={summary.events}
          href={`/novels/${novelId}/timeline`}
        />
        <SummaryCard
          label={<T k="adaptations.title" />}
          count={summary.adaptations}
          href={`/novels/${novelId}/adaptations`}
        />
      </div>
    </section>
  );
}
