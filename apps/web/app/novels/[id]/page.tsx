import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Chapter, Character, Tag } from '../../types'
import AddChapterForm from './AddChapterForm'
import ChapterListWithFilters from './ChapterListWithFilters'
import {
  backLinkClassName,
  cardClassName,
  chipClassName,
  DashboardPage,
  formatDisplayDate,
  mutedCardClassName,
  SectionHeading,
  statusColorClassNames,
} from '../ui'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const STATUS_LABELS: Record<Novel['status'], string> = {
  reading: 'Reading',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

async function getNovel(id: string): Promise<Novel | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return body.data as Novel
  } catch {
    return null
  }
}

async function getChapters(id: string): Promise<Chapter[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/chapters`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return ((body.data as Chapter[]) ?? []).map((chapter) => ({
      ...chapter,
      tags: chapter.tags ?? [],
    }))
  } catch {
    return []
  }
}

async function getCharacters(id: string): Promise<Character[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/characters`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Character[]) ?? []
  } catch {
    return []
  }
}

async function getTags(id: string): Promise<Tag[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/tags`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Tag[]) ?? []
  } catch {
    return []
  }
}

export default async function NovelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, chapters, characters, tags] = await Promise.all([
    getNovel(id),
    getChapters(id),
    getCharacters(id),
    getTags(id),
  ])

  if (!novel) notFound()

  const sorted = [...chapters].sort((a, b) => a.number - b.number)
  const availableTags =
    tags.length > 0
      ? tags
      : sorted
          .flatMap((chapter) => chapter.tags)
          .filter((tag, index, array) => array.findIndex((entry) => entry.id === tag.id) === index)

  const readCount = sorted.filter((chapter) => chapter.read_at).length

  return (
    <DashboardPage maxWidth="max-w-6xl">
      <div className="space-y-5">
        <Link
          href="/novels"
          className={backLinkClassName}
        >
          ← All novels
        </Link>

        <SectionHeading
          eyebrow="Novel"
          title={novel.title}
          description={
            novel.description ||
            'Story workspace for chapters, timeline markers, and character tracking.'
          }
          action={<AddChapterForm novelId={id} />}
        />

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={mutedCardClassName}>
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Overview
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColorClassNames[novel.status]}`}
                    >
                      {STATUS_LABELS[novel.status]}
                    </span>
                    {novel.author ? (
                      <span className={chipClassName}>{novel.author}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        Chapters
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{sorted.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        Read
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{readCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Explore
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  <Link
                    href={`/novels/${id}/characters`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
                    <p className="text-sm font-semibold text-stone-900">Characters</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {characters.length} tracked cast members
                    </p>
                  </Link>
                  <Link
                    href={`/novels/${id}/timeline`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
                    <p className="text-sm font-semibold text-stone-900">Timeline</p>
                    <p className="mt-1 text-sm text-stone-500">
                      Plot sequence and in-world date rail
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Chapters
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                    Reading structure
                  </h2>
                </div>
                <div className="text-right text-sm text-stone-500">
                  {novel.updated_at ? formatDisplayDate(novel.updated_at) : null}
                </div>
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
                No chapters yet.
              </div>
            ) : (
              <ChapterListWithFilters
                novelId={id}
                chapters={sorted}
                availableTags={availableTags}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardPage>
  )
}
