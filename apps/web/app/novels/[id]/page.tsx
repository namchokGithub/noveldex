import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Volume, Chapter, Character, Tag } from '../../types'
import AddChapterForm from './AddChapterForm'
import ChapterListWithFilters from './ChapterListWithFilters'
import { T } from '@/components/i18n/I18nProvider'
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

async function getVolumes(novelId: string): Promise<Volume[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/volumes`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Volume[]) ?? []
  } catch {
    return []
  }
}

async function getChaptersByVolume(novelId: string, volumeId: string): Promise<Chapter[]> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
      { cache: 'no-store' }
    )
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

  const [novel, volumes, characters, tags] = await Promise.all([
    getNovel(id),
    getVolumes(id),
    getCharacters(id),
    getTags(id),
  ])

  if (!novel) notFound()

  const chapters = (
    await Promise.all(volumes.map((v) => getChaptersByVolume(id, v.id)))
  ).flat()

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
        <Link href="/novels" className={backLinkClassName}>
          ← <T k="nav.allNovels" />
        </Link>

        <SectionHeading
          eyebrow={<T k="novel.eyebrow" />}
          title={novel.title}
          description={novel.description || <T k="novel.workspaceFallback" />}
          action={<AddChapterForm novelId={id} volumeId={volumes[0]?.id ?? ''} />}
        />

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
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColorClassNames[novel.status]}`}
                    >
                      <T k={`status.${novel.status}` as const} />
                    </span>
                    {novel.author ? (
                      <span className={chipClassName}>{novel.author}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novel.chapters" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{sorted.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novel.read" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{readCount}</p>
                    </div>
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
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      <T k="novel.characters" />
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T k="novel.trackedCast" values={{ count: characters.length }} />
                    </p>
                  </Link>
                  <Link
                    href={`/novels/${id}/timeline`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
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
            <div className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    <T k="novel.chapters" />
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                    <T k="novel.readingStructure" />
                  </h2>
                </div>
                <div className="text-right text-sm text-stone-500">
                  {novel.updated_at ? formatDisplayDate(novel.updated_at) : null}
                </div>
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
                <T k="novel.noChapters" />
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
