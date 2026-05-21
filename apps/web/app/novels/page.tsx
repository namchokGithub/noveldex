import Link from "next/link";
import type { Novel } from "../types";
import { T } from "@/components/i18n/I18nProvider";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const STATUS_COLORS: Record<Novel["status"], string> = {
  reading: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200",
  completed:
    "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  dropped: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
  on_hold: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

async function getNovels(): Promise<Novel[] | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as Novel[];
  } catch {
    return null;
  }
}

export default async function NovelsPage() {
  const novels = await getNovels();
  const totalNovels = novels?.length ?? 0;
  const hasSingleNovel = totalNovels === 1;
  const featuredNovel = hasSingleNovel ? novels?.[0] : null;
  const readingCount =
    novels?.filter((novel) => novel.status === "reading").length ?? 0;
  const completedCount =
    novels?.filter((novel) => novel.status === "completed").length ?? 0;
  const pausedCount =
    novels?.filter((novel) => novel.status === "on_hold").length ?? 0;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f6f0_0%,#f3efe6_52%,#ece7db_100%)] px-4 py-6 text-stone-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_rgba(120,108,84,0.12)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,240,232,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  <T k="novels.dashboard" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-4xl">
                      <T k="novels.libraryTitle" />
                    </h1>
                    <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-stone-50">
                      <T
                        k={
                          totalNovels === 1
                            ? "novels.count.one"
                            : "novels.count.other"
                        }
                        values={{ count: totalNovels }}
                      />
                    </span>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                    <T k="novels.heroDescription" />
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:min-w-72 sm:max-w-sm sm:self-stretch lg:items-end">
                {/* Disabled for now */}
                {/* <div className="flex justify-start lg:justify-end">
                  <AddNovelForm />
                </div> */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-500 shadow-sm">
                  <div>
                    <p className="font-medium text-stone-700">
                      <T k="novels.quickSearch" />
                    </p>
                    <p className="text-xs text-stone-500">
                      <T k="novels.quickSearchHelp" />
                    </p>
                  </div>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600">
                    ⌘K
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="rounded-[22px] border border-stone-200 bg-stone-50/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="mb-5 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    <T k="novels.collection" />
                  </p>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-stone-900">
                    <T k="novels.readingSnapshot" />
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                      <T k="novels.activeNow" />
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tighter text-stone-950">
                      {readingCount}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T k="novels.inProgress" />
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novels.done" />
                      </p>
                      <p className="mt-2 text-xl font-semibold text-stone-900">
                        {completedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novels.onHold" />
                      </p>
                      <p className="mt-2 text-xl font-semibold text-stone-900">
                        {pausedCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-stone-200 pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    <T k="novels.workflow" />
                  </p>
                  <ul className="mt-3 space-y-3 text-sm text-stone-600">
                    <li className="flex gap-3">
                      <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <T k="novels.workflow.openNovel" />
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <T k="novels.workflow.keepStatus" />
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <T k="novels.workflow.search" />
                    </li>
                  </ul>
                </div>
              </aside>

              <div className="min-w-0">
                {novels === null ? (
                  <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
                    <p className="text-base font-semibold text-rose-700">
                      <T k="novels.failedTitle" />
                    </p>
                    <p className="mt-2 text-sm text-rose-600">
                      <T k="novels.failedBody" />
                    </p>
                  </div>
                ) : novels.length === 0 ? (
                  <div className="flex min-h-105 flex-col items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center shadow-sm">
                    <div className="mb-4 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                      <T k="novels.emptyEyebrow" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-900">
                      <T k="novels.emptyTitle" />
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-stone-600">
                      <T k="novels.emptyBody" />
                    </p>
                  </div>
                ) : hasSingleNovel && featuredNovel ? (
                  <div className="mx-auto max-w-5xl">
                    <Link
                      href={`/novels/${featuredNovel.id}`}
                      className="group relative block overflow-hidden rounded-3xl border border-stone-200/90 bg-[#fdfaf3] p-5 shadow-[0_14px_36px_rgba(120,108,84,0.10)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_18px_48px_rgba(120,108,84,0.18)]">
                      {/* base warm gradient: ครอบทั้งการ์ด บน→ล่าง */}
                      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7f2e8_100%)]" />
                      {/* accent glow: ฟ้า + ส้ม นุ่มๆ มุมบน */}
                      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_55%)]" />

                      {/* content — z-10 ให้อยู่เหนือ gradient */}
                      <div className="relative z-10 flex h-full flex-col gap-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-stone-950 text-lg font-semibold text-stone-50 shadow-[0_16px_30px_rgba(41,37,36,0.24)]">
                              {featuredNovel.title.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-400">
                                {featuredNovel.author || (
                                  <T k="novels.unknownAuthor" />
                                )}
                              </p>
                              <h2 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight tracking-tighter text-stone-950 sm:text-4xl xl:text-[3.4rem]">
                                {featuredNovel.title}
                              </h2>
                              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                                <T k="novels.heroDescription" />
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 self-start rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_COLORS[featuredNovel.status]}`}>
                            <T k={`status.${featuredNovel.status}` as const} />
                          </span>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
                          <div className="rounded-[28px] border border-white/80 bg-white/76 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm sm:p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                              <T k="common.overview" />
                            </p>
                            <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
                              {featuredNovel.description || (
                                <T k="novels.noDescription" />
                              )}
                            </p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                            <div className="rounded-3xl  border border-white/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                                <T k="common.updated" />
                              </p>
                              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-stone-900">
                                {formatDate(featuredNovel.updated_at) ?? (
                                  <T k="novels.recentlyUpdated" />
                                )}
                              </p>
                            </div>
                            <div className="rounded-3xl border border-white/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                                <T k="novels.activeNow" />
                              </p>
                              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-stone-900">
                                {readingCount}
                              </p>
                            </div>
                            <div className="rounded-3xl  border border-stone-900/90 bg-stone-950 p-4 text-stone-50 shadow-[0_18px_38px_rgba(41,37,36,0.22)]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">
                                <T k="novels.workflow" />
                              </p>
                              <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                                <T k="novels.openNovel" />
                              </p>
                              <p className="mt-1 text-sm text-stone-300">
                                <T k="novels.quickSearchHelp" />
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {novels.map((novel) => (
                      <Link
                        key={novel.id}
                        href={`/novels/${novel.id}`}
                        className="group relative overflow-hidden rounded-3xl border border-stone-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7f2e8_100%)] p-5 shadow-[0_14px_36px_rgba(120,108,84,0.10)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_18px_48px_rgba(120,108,84,0.18)]">
                        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_62%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_58%)]" />

                        <div className="relative flex h-full flex-col gap-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-stone-50 shadow-sm">
                                {novel.title.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                                  {novel.author || (
                                    <T k="novels.unknownAuthor" />
                                  )}
                                </p>
                                <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug tracking-[-0.03em] text-stone-950">
                                  {novel.title}
                                </h2>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[novel.status]}`}>
                              <T k={`status.${novel.status}` as const} />
                            </span>
                          </div>

                          <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                              <T k="common.overview" />
                            </p>
                            <p className="mt-2 line-clamp-4 text-sm leading-6 text-stone-600">
                              {novel.description || (
                                <T k="novels.noDescription" />
                              )}
                            </p>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-3 border-t border-stone-200/80 pt-4 text-sm text-stone-500">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                                <T k="common.updated" />
                              </p>
                              <p className="mt-1 font-medium text-stone-700">
                                {formatDate(novel.updated_at) ?? (
                                  <T k="novels.recentlyUpdated" />
                                )}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-50 transition group-hover:bg-stone-800">
                              <T k="novels.openNovel" />
                              <span aria-hidden="true">→</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
