import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
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
import RecentNovelPageTracker from "@/components/navigation/RecentNovelPageTracker";
import {
  getAdaptationsByChapter,
  getAllCharacters,
  getChapter,
  getEntities,
  getEventsByChapter,
} from "@/libs/api";
import { buildEntityId } from "@/libs/entities/keys";
import { charactersByIds } from "@/libs/charactersByIds";
import { ResourceNotFoundError } from "@/libs/errors";
import { formatChapterPrefix } from "@/libs/chapterLabel";
import type { ChapterWithCharacters } from "@/app/types";
import { CircleChevronLeft } from "lucide-react";

// Next.js calls generateMetadata and the page body separately for the same
// request; cache() dedupes their getChapter() calls into a single Firestore read.
// Scoped to this server-only route file, not the shared libs/firebase export
// (ChapterEditor also calls getChapter client-side after mutations and must
// always get a fresh read there).
const getChapterCached = cache(getChapter);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; chapterId: string }>;
}): Promise<Metadata> {
  const { id, volumeId, chapterId } = await params;

  try {
    const chapter = await getChapterCached(id, volumeId, chapterId, false);

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

  let chapter: ChapterWithCharacters;
  let events;
  let adaptations;
  let noteEntities;
  let noteCharacters;

  try {
    const [
      loadedChapter,
      loadedEvents,
      loadedAdaptations,
      characters,
      genericEntities,
    ] = await Promise.all([
      getChapterCached(id, volumeId, chapterId, false),
      getEventsByChapter(id, chapterId),
      getAdaptationsByChapter(id, volumeId, chapterId),
      getAllCharacters(id),
      getEntities(id),
    ]);
    chapter = {
      ...loadedChapter,
      characters: charactersByIds(characters, loadedChapter.character_ids),
    };
    events = loadedEvents;
    adaptations = loadedAdaptations;
    noteCharacters = characters;
    noteEntities = [
      ...characters.map((character) => ({
        id: buildEntityId(id, "character", character.id),
        novelId: id,
        type: "character" as const,
        name: character.name,
        aliases: character.aliases,
        description: character.description,
      })),
      ...genericEntities,
    ];
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  const chapterPrefix = formatChapterPrefix(chapter, {
    chapter: "Ch.",
    prologue: "Prologue",
    epilogue: "Epilogue",
    afterword: "Afterword",
    side_story: "Side Story",
    other: "Other",
  });

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <RecentNovelPageTracker novelId={id} label={chapterPrefix} />
        <Link
          id="chapter-back-link"
          href={`/novels/${id}/volumes/${volumeId}`}
          className={backLinkClassName}>
          <CircleChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <T k="nav.backToVolume" />
        </Link>

        <SectionHeading
          eyebrow={chapterPrefix}
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
              characters={noteCharacters}
              entities={noteEntities}
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
