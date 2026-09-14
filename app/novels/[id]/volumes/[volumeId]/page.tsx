import Link from "next/link";
import { notFound } from "next/navigation";
import AddChapterForm from "../../AddChapterForm";
import BackToTopButton from "../../../BackToTopButton";
import ChapterListWithFilters from "../../ChapterListWithFilters";
import VolumeDescriptionEditor from "./VolumeDescriptionEditor";
import LocalizedVolumeTitle from "@/components/volumes/LocalizedVolumeTitle";
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

  const chapterCount = chapters.filter(
    (chapter) => chapter.kind === "chapter",
  ).length;

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
    <DashboardPage maxWidth="w-[60vw]">
      <div className="space-y-5">
        <Link
          id="volume-back-link"
          href={`/novels/${id}`}
          className={backLinkClassName}>
          ← Back to {novel.title}
        </Link>

        <SectionHeading
          eyebrow={`Volume ${volume.number}`}
          title={<LocalizedVolumeTitle volume={volume} />}
          description={`Manage chapters inside this volume. Updated ${formatDisplayDate(volume.updated_at) ?? volume.updated_at}.`}
          action={<AddChapterForm novelId={id} volumeId={volume.id} />}
        />

        <VolumeDescriptionEditor
          novelId={id}
          volumeId={volume.id}
          initialDescription={volume.description}
          collapsedLines={3}
        />

        <ChapterListWithFilters
          novelId={id}
          volumeId={volumeId}
          chapters={chapters}
          availableTags={availableTags}
          sidebar={
            <>
              <div className={cardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Chapters
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                  {chapterCount} chapter
                  {chapterCount === 1 ? "" : "s"}
                </h2>
              </div>
            </>
          }
        />
        <BackToTopButton anchorId="volume-back-link" />
      </div>
    </DashboardPage>
  );
}
