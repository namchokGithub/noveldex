import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterEditor from "./ChapterEditor";
import ChapterNotesEditor from "./ChapterNotesEditor";
import ChapterTitleEditor from "./ChapterTitleEditor";
import ChapterCrossReferences from "./ChapterCrossReferences";
import BackToTopButton from "@/app/novels/BackToTopButton";
import {
  backLinkClassName,
  DashboardPage,
  SectionHeading,
} from "@/app/novels/ui";
import { T } from "@/components/i18n/I18nProvider";
import {
  getAdaptationsByChapter,
  getChapter,
  getEventsByChapter,
} from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";
import { formatChapterPrefix } from "@/libs/chapterLabel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; chapterId: string }>;
}): Promise<Metadata> {
  const { id, volumeId, chapterId } = await params;

  try {
    const chapter = await getChapter(id, volumeId, chapterId);

    return {
      title: chapter.title_en || chapter.title,
      description: chapter.summary || undefined,
    };
  } catch {
    return {
      title: "Chapter",
    };
  }
}

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; volumeId: string; chapterId: string }>;
  searchParams: Promise<{ find?: string; note?: string }>;
}) {
  const { id, volumeId, chapterId } = await params;
  const { find = "", note = "" } = await searchParams;

  let chapter;
  let events;
  let adaptations;

  try {
    [chapter, events, adaptations] = await Promise.all([
      getChapter(id, volumeId, chapterId),
      getEventsByChapter(id, chapterId),
      getAdaptationsByChapter(id, volumeId, chapterId),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <Link
          id="chapter-back-link"
          href={`/novels/${id}/volumes/${volumeId}`}
          className={backLinkClassName}>
          ← <T k="nav.backToVolume" />
        </Link>

        <SectionHeading
          eyebrow={formatChapterPrefix(chapter, {
            chapter: "Ch.",
            prologue: "Prologue",
            epilogue: "Epilogue",
            afterword: "Afterword",
            side_story: "Side Story",
            other: "Other",
          })}
          title={
            <ChapterTitleEditor
              chapter={chapter}
              novelId={id}
              volumeId={volumeId}
            />
          }
        />

        <ChapterEditor
          chapter={chapter}
          novelId={id}
          volumeId={volumeId}
          showSummary={false}
          notesEditor={
            <ChapterNotesEditor
              notes={chapter.notes}
              characters={chapter.characters}
              tags={chapter.tags}
              novelId={id}
              volumeId={volumeId}
              chapterId={chapter.id}
              initialFind={find}
              initialNoteId={note}
            />
          }
        />
        <ChapterCrossReferences
          novelId={id}
          chapter={chapter}
          events={events}
          adaptations={adaptations}
        />
        <BackToTopButton anchorId="chapter-back-link" />
      </div>
    </DashboardPage>
  );
}
