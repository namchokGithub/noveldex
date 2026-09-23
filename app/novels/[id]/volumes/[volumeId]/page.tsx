import Link from "next/link";
import { notFound } from "next/navigation";
import AddChapterForm from "../../AddChapterForm";
import BackToTopButton from "../../../BackToTopButton";
import ChapterListWithFilters from "../../ChapterListWithFilters";
import VolumeDescriptionEditor from "./VolumeDescriptionEditor";
import VolumeTitleEditor from "./VolumeTitleEditor";
import AdaptationSection from "./AdaptationSection";
import VolumeSourceImageModal from "./VolumeSourceImageModal";
import LocalizedVolumePageDescription from "@/components/volumes/LocalizedVolumePageDescription";
import { T } from "@/components/i18n/I18nProvider";
import RecentNovelPageTracker from "@/components/navigation/RecentNovelPageTracker";
import {
  backLinkClassName,
  DashboardPage,
  SectionHeading,
  secondaryButtonClassName,
} from "@/app/novels/ui";
import {
  getAdjacentVolumeMetadata,
  getChaptersByVolume,
  getLatestAdaptationByVolume,
  getNovel,
  getVolumeMetadata,
} from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";
import { volumeRecentPageLabel } from "@/libs/recentNovelPages";
import { CircleChevronLeft } from "lucide-react";

export default async function VolumePage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string }>;
}) {
  const { id, volumeId } = await params;
  let novel: Awaited<ReturnType<typeof getNovel>>;
  let volume: Awaited<ReturnType<typeof getVolumeMetadata>>;
  let chapters: Awaited<ReturnType<typeof getChaptersByVolume>>;
  let latestAdaptation: Awaited<ReturnType<typeof getLatestAdaptationByVolume>>;
  let adjacentVolumes: Awaited<ReturnType<typeof getAdjacentVolumeMetadata>>;

  try {
    [novel, volume, chapters, latestAdaptation] = await Promise.all([
      getNovel(id),
      getVolumeMetadata(id, volumeId),
      getChaptersByVolume(id, volumeId),
      getLatestAdaptationByVolume(id, volumeId),
    ]);
    adjacentVolumes = await getAdjacentVolumeMetadata(id, volume.number);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  const availableTags = chapters
    .flatMap((chapter) => chapter.tags)
    .filter(
      (tag, index, array) =>
        array.findIndex((entry) => entry.id === tag.id) === index,
    );

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <RecentNovelPageTracker
          novelId={id}
          label={volumeRecentPageLabel(
            volume.number,
            volume.title_en || volume.title,
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            id="volume-back-link"
            href={`/novels/${id}`}
            className={backLinkClassName}>
            <CircleChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />{" "}
            Back to {novel.title}
          </Link>
          <VolumeNavigation novelId={id} {...adjacentVolumes} />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {volume.source_img_url ? (
            <VolumeSourceImageModal
              title={volume.title}
              sourceImgUrl={volume.source_img_url}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <SectionHeading
              eyebrow={
                <T k="volume.pageEyebrow" values={{ number: volume.number }} />
              }
              title={<VolumeTitleEditor volume={volume} novelId={id} />}
              description={
                <LocalizedVolumePageDescription updatedAt={volume.updated_at} />
              }
              action={<AddChapterForm novelId={id} volumeId={volume.id} />}
            />
          </div>
        </div>
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
              <AdaptationSection
                novelId={id}
                volumeId={volumeId}
                adaptation={latestAdaptation}
              />
            </>
          }
        />
        <BackToTopButton anchorId="volume-back-link" />
      </div>
    </DashboardPage>
  );
}

function VolumeNavigation({
  novelId,
  previous,
  next,
}: {
  novelId: string;
  previous: { id: string; number: number } | null;
  next: { id: string; number: number } | null;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Volume navigation"
      className="ml-auto flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
      {previous ? (
        <Link
          href={`/novels/${novelId}/volumes/${previous.id}`}
          className={`${secondaryButtonClassName} min-w-0 justify-start`}>
          <span aria-hidden="true">←</span>
          <span className="min-w-0 truncate">
            <T k="common.previous" /> #{previous.number}
          </span>
        </Link>
      ) : null}
      {next ? (
        <Link
          href={`/novels/${novelId}/volumes/${next.id}`}
          className={`${secondaryButtonClassName} min-w-0 justify-end text-right`}>
          <span className="min-w-0 truncate">
            <T k="common.next" /> #{next.number}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </nav>
  );
}
