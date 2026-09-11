import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterEditor from "./ChapterEditor";
import ChapterNotesEditor from "./ChapterNotesEditor";
import {
  backLinkClassName,
  DashboardPage,
  SectionHeading,
} from "@/app/novels/ui";
import { T } from "@/components/i18n/I18nProvider";
import { getChapter } from "@/libs/api";
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
      title: chapter.title,
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

  try {
    chapter = await getChapter(id, volumeId, chapterId);
  } catch {
    notFound();
  }

  return (
    <DashboardPage maxWidth="w-[60vw]">
      <div className="space-y-5">
        <Link
          href={`/novels/${id}/volumes/${volumeId}`}
          className={backLinkClassName}>
          ← <T k="nav.backToVolume" />
        </Link>

        <SectionHeading
          eyebrow={formatChapterPrefix(chapter, { chapter: "Ch.", prologue: "Prologue", epilogue: "Epilogue", afterword: "Afterword", side_story: "Side Story", other: "Other" })}
          title={chapter.title}
          description={<T k="chapter.pageDescription" />}
        />

        <ChapterNotesEditor notes={chapter.notes} characters={chapter.characters} tags={chapter.tags} novelId={id} volumeId={volumeId} chapterId={chapter.id} initialFind={find} initialNoteId={note} />
        <ChapterEditor chapter={chapter} novelId={id} volumeId={volumeId} showSummary={false} />
      </div>
    </DashboardPage>
  );
}
