import Link from "next/link";
import { notFound } from "next/navigation";
import AddVolumeForm from "./AddVolumeForm";
import NovelCover from "../NovelCover";
import BackToTopButton from "../BackToTopButton";
import ExpandableDescription from "../ExpandableDescription";
import VolumeManager from "./VolumeManager";
import { T } from "@/components/i18n/I18nProvider";
import {
  backLinkClassName,
  cardClassName,
  chipClassName,
  DashboardPage,
  mutedCardClassName,
  statusColorClassNames,
} from "../ui";
import { getAllCharacters, getNovel, getVolumes } from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";

const ALLOWED_PAGE_SIZES = new Set([5, 10, 20, 50]);

export default async function NovelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; per_page?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parsePositiveInt(resolvedSearchParams.page, 1);
  const requestedPerPage = parsePositiveInt(resolvedSearchParams.per_page, 5);
  const perPage = ALLOWED_PAGE_SIZES.has(requestedPerPage)
    ? requestedPerPage
    : 5;
  let novel;
  let volumes;
  let characters;

  try {
    [novel, volumes, characters] = await Promise.all([
      getNovel(id),
      getVolumes(id, { page, perPage }),
      getAllCharacters(id),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }

  const totalChapters = volumes.summary.total_chapters;
  const readCount = volumes.summary.read_count;

  return (
    <DashboardPage maxWidth="w-full max-w-6xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link id="novel-back-link" href="/novels" className={backLinkClassName}>
            ← <T k="nav.allNovels" />
          </Link>
          <AddVolumeForm novelId={id} />
        </div>

        <div className="space-y-4">
            <section className={`${cardClassName} overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,241,232,0.9))]`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative shrink-0 self-start">
                  <NovelCover
                    title={novel.title}
                    coverUrl={novel.cover_url}
                    alt={novel.title}
                    className="h-40 w-28 rounded-3xl object-cover shadow-[0_18px_36px_rgba(41,37,36,0.18)] sm:h-44 sm:w-32"
                    fallbackClassName="relative shadow-[0_18px_36px_rgba(41,37,36,0.22)]"
                    titleClassName="text-2xl"
                  />
                  <div className="pointer-events-none absolute -inset-2 -z-10 rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_56%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.18),transparent_60%)] blur-xl" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Cover
                  </p>
                  <h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-2xl">
                    {novel.title}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    {novel.author || <T k="novels.unknownAuthor" />}
                  </p>
                  <div className="mt-3">
                    <ExpandableDescription collapsedLines={3} className="max-w-none">
                      {novel.description || <T k="novel.workspaceFallback" />}
                    </ExpandableDescription>
                  </div>
                </div>
              </div>
            </section>

            <section className={cardClassName}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                <T k="common.overview" />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColorClassNames[novel.status]}`}>
                  <T k={`status.${novel.status}` as const} />
                </span>
                {novel.author ? <span className={chipClassName}>{novel.author}</span> : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/70 sm:px-4 sm:py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:text-[11px] sm:tracking-[0.22em]"><T k="novel.volumes" /></p>
                  <p className="mt-1 text-xl font-semibold text-stone-900 sm:mt-2 sm:text-2xl">{volumes.summary.total_volumes}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/70 sm:px-4 sm:py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:text-[11px] sm:tracking-[0.22em]"><T k="novel.chapters" /></p>
                  <p className="mt-1 text-xl font-semibold text-stone-900 sm:mt-2 sm:text-2xl">{totalChapters}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/70 sm:px-4 sm:py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:text-[11px] sm:tracking-[0.22em]"><T k="novel.read" /></p>
                  <p className="mt-1 text-xl font-semibold text-stone-900 sm:mt-2 sm:text-2xl">{readCount}</p>
                </div>
              </div>
            </section>

            <section className={mutedCardClassName}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                <T k="novel.explore" />
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                <Link
                  href={`/novels/${id}/characters`}
                  className={`${cardClassName} p-3 transition hover:border-stone-300 hover:bg-white sm:p-4`}>
                  <p className="text-sm font-semibold text-stone-900">
                    <T k="novel.characters" />
                  </p>
                  <p className="mt-1 hidden text-sm text-stone-500 sm:block">
                    <T k="novel.trackedCast" values={{ count: characters.length }} />
                  </p>
                </Link>
                <Link
                  href={`/novels/${id}/timeline`}
                  className={`${cardClassName} p-3 transition hover:border-stone-300 hover:bg-white sm:p-4`}>
                  <p className="text-sm font-semibold text-stone-900">
                    <T k="novel.timeline" />
                  </p>
                  <p className="mt-1 hidden text-sm text-stone-500 sm:block">
                    <T k="novel.timelineHelp" />
                  </p>
                </Link>
              </div>
            </section>

            <VolumeManager
              novelId={id}
              volumes={volumes.items.map((volume) => ({
                id: volume.id,
                novel_id: volume.novel_id,
                number: volume.number,
                title: volume.title,
                title_en: volume.title_en,
                title_th: volume.title_th,
                description: volume.description,
                chapter_count: volume.chapter_count,
                read_count: volume.read_count,
                created_at: volume.created_at,
                updated_at: volume.updated_at,
                chapterCount: volume.chapter_count,
              }))}
              pagination={volumes.pagination}
            />
        </div>
        <BackToTopButton anchorId="novel-back-link" />
      </div>
    </DashboardPage>
  );
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
