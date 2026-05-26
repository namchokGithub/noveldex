import Link from "next/link";
import { notFound } from "next/navigation";
import AddChapterForm from "../../AddChapterForm";
import ChapterListWithFilters from "../../ChapterListWithFilters";
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  formatDisplayDate,
  SectionHeading,
} from "@/app/novels/ui";
import { getChaptersByVolume, getNovel, getTags, getVolume } from "@/libs/api";

export default async function VolumePage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string }>;
}) {
  const { id, volumeId } = await params;
  let novel: Awaited<ReturnType<typeof getNovel>>;
  let volume: Awaited<ReturnType<typeof getVolume>>;
  let chapters: Awaited<ReturnType<typeof getChaptersByVolume>>;
  let tags: Awaited<ReturnType<typeof getTags>>;

  try {
    [novel, volume, chapters, tags] = await Promise.all([
      getNovel(id),
      getVolume(id, volumeId),
      getChaptersByVolume(id, volumeId),
      getTags(id),
    ]);
  } catch {
    notFound();
  }

  const availableTags =
    tags.length > 0
      ? tags
      : chapters
          .flatMap((chapter) => chapter.tags)
          .filter(
            (tag, index, array) =>
              array.findIndex((entry) => entry.id === tag.id) === index,
          );

  return (
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← Back to {novel.title}
        </Link>

        <SectionHeading
          eyebrow={`Volume ${volume.number}`}
          title={volume.title}
          description={`Manage chapters inside this volume. Updated ${formatDisplayDate(volume.updated_at) ?? volume.updated_at}.`}
          action={<AddChapterForm novelId={id} volumeId={volume.id} />}
        />

        <div className={cardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Chapters
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
              </h2>
            </div>
            <p className="text-sm text-stone-500">Novel → Volume → Chapter</p>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="flex min-h-65 items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
            No chapters in this volume yet.
          </div>
        ) : (
          <ChapterListWithFilters
            novelId={id}
            chapters={[...chapters].sort((a, b) => a.number - b.number)}
            availableTags={availableTags}
          />
        )}
      </div>
    </DashboardPage>
  );
}
