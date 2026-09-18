import Link from "next/link";
import { notFound } from "next/navigation";
import BackToTopButton from "@/app/novels/BackToTopButton";
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  SectionHeading,
} from "@/app/novels/ui";
import { ChapterLabel } from "@/components/chapters/ChapterLabel";
import { T } from "@/components/i18n/I18nProvider";
import {
  getAdaptation,
  getChaptersByVolume,
  getNovel,
  getVolumeMetadata,
} from "@/libs/api";
import { linkedEntitiesForAdaptation } from "@/libs/adaptationDetailRelations";
import { ResourceNotFoundError } from "@/libs/errors";

export default async function AdaptationDetailPage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; adaptationId: string }>;
}) {
  const { id, volumeId, adaptationId } = await params;
  let novel: Awaited<ReturnType<typeof getNovel>>;
  let volume: Awaited<ReturnType<typeof getVolumeMetadata>>;
  let adaptation: Awaited<ReturnType<typeof getAdaptation>>;
  let chapters: Awaited<ReturnType<typeof getChaptersByVolume>>;

  try {
    // This page only reads volume.number/title, so fetch metadata only —
    // getVolume() would also aggregate chapter_count/read_count by reading
    // every chapter in the volume a second time (chapters is already fetched below).
    [novel, volume, adaptation, chapters] = await Promise.all([
      getNovel(id),
      getVolumeMetadata(id, volumeId),
      getAdaptation(id, volumeId, adaptationId),
      getChaptersByVolume(id, volumeId),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  const adaptedChapters = chapters.filter((chapter) =>
    adaptation.adapted_chapter_ids.includes(chapter.id),
  );
  const entities = linkedEntitiesForAdaptation(adaptation);

  return (
    <DashboardPage maxWidth="w-full max-w-4xl">
      <div className="space-y-5">
        <Link
          id="adaptation-detail-back-link"
          href={`/novels/${id}/adaptations#adaptation-${adaptationId}`}
          className={backLinkClassName}>
          ← {novel.title}
        </Link>
        <SectionHeading
          eyebrow={<T k="adaptations.title" />}
          title={`${adaptation.entry_type} ${adaptation.entry_number} · ${adaptation.title}`}
          description={adaptation.description}
          action={
            <Link
              href={`/novels/${id}/volumes/${volumeId}/adaptations/${adaptationId}/notes`}
              className={backLinkClassName}>
              <T k="adaptationDetail.notes" />
            </Link>
          }
        />

        <section className={cardClassName}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            <T k="adaptationDetail.parentVolume" />
          </p>
          <Link
            href={`/novels/${id}/volumes/${volumeId}`}
            className="mt-3 block text-sm font-medium text-stone-800 transition hover:text-stone-500">
            <T k="adaptations.volume" /> {volume.number} · {volume.title}
          </Link>
          {adaptation.source_url ? (
            <a
              href={adaptation.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-medium text-sky-700 hover:underline">
              <T k="adaptations.source" />
            </a>
          ) : null}
        </section>

        {adaptedChapters.length > 0 ? (
          <section className={cardClassName}>
            <h2 className="text-lg font-semibold text-stone-950">
              <T k="adaptationDetail.adaptedChapters" />
            </h2>
            <div className="mt-4 space-y-2">
              {adaptedChapters.map((chapter) => (
                <Link
                  key={chapter.id}
                  href={`/novels/${id}/volumes/${volumeId}/chapters/${chapter.id}`}
                  className="block rounded-xl px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50 hover:text-stone-950">
                  <ChapterLabel chapter={chapter} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {entities.length > 0 ? (
          <section className={cardClassName}>
            <h2 className="text-lg font-semibold text-stone-950">
              <T k="adaptationDetail.storyEntities" />
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/novels/${id}/entities/${encodeURIComponent(entity.id)}`}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-200 hover:text-stone-950">
                  {entity.label}
                  <span className="ml-1.5 text-xs text-stone-400">
                    {entity.type}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <BackToTopButton anchorId="adaptation-detail-back-link" />
      </div>
    </DashboardPage>
  );
}
