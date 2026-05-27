import Link from "next/link";
import { notFound } from "next/navigation";
import type { Character } from "../../types";
import AddVolumeForm from "./AddVolumeForm";
import NovelCover from "../NovelCover";
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
import { getChaptersByVolume, getNovel, getVolumes } from "@/libs/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getCharacters(id: string): Promise<Character[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/characters`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data as Character[]) ?? [];
  } catch {
    return [];
  }
}

export default async function NovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let novel;
  let volumes;
  let characters;

  try {
    [novel, volumes, characters] = await Promise.all([
      getNovel(id),
      getVolumes(id),
      getCharacters(id),
    ]);
  } catch {
    notFound();
  }

  const chaptersByVolume = await Promise.all(
    volumes.map(async (volume) => ({
      ...volume,
      chapters: await getChaptersByVolume(id, volume.id),
    })),
  );

  const totalChapters = chaptersByVolume.reduce(
    (sum, volume) => sum + volume.chapters.length,
    0,
  );
  const readCount = chaptersByVolume.reduce(
    (sum, volume) =>
      sum + volume.chapters.filter((chapter) => chapter.read_at).length,
    0,
  );

  return (
    <DashboardPage maxWidth="max-w-6xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/novels" className={backLinkClassName}>
            ← <T k="nav.allNovels" />
          </Link>
          <AddVolumeForm novelId={id} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={mutedCardClassName}>
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  <T k="common.overview" />
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColorClassNames[novel.status]}`}>
                      <T k={`status.${novel.status}` as const} />
                    </span>
                    {novel.author ? (
                      <span className={chipClassName}>{novel.author}</span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        Volumes
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">
                        {volumes.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novel.chapters" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">
                        {totalChapters}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                      <T k="novel.read" />
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">
                      {readCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  <T k="novel.explore" />
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  <Link
                    href={`/novels/${id}/characters`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}>
                    <p className="text-sm font-semibold text-stone-900">
                      <T k="novel.characters" />
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T
                        k="novel.trackedCast"
                        values={{ count: characters.length }}
                      />
                    </p>
                  </Link>
                  <Link
                    href={`/novels/${id}/timeline`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}>
                    <p className="text-sm font-semibold text-stone-900">
                      <T k="novel.timeline" />
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T k="novel.timelineHelp" />
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div
              className={`${cardClassName} overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,241,232,0.9))]`}>
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
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">
                    {novel.description || <T k="novel.workspaceFallback" />}
                  </p>
                </div>
              </div>
            </div>

            <VolumeManager
              novelId={id}
              volumes={chaptersByVolume.map((volume) => ({
                id: volume.id,
                novel_id: volume.novel_id,
                number: volume.number,
                title: volume.title,
                created_at: volume.created_at,
                updated_at: volume.updated_at,
                chapterCount: volume.chapters.length,
              }))}
            />
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
