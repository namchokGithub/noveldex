import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Chapter, Character } from '../../types'
import AddChapterForm from './AddChapterForm'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const STATUS_LABELS: Record<Novel['status'], string> = {
  reading: 'Reading',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

const STATUS_COLORS: Record<Novel['status'], string> = {
  reading: 'bg-blue-900 text-blue-300',
  completed: 'bg-green-900 text-green-300',
  dropped: 'bg-red-900 text-red-300',
  on_hold: 'bg-yellow-900 text-yellow-300',
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
    return (body.data as Chapter[]) ?? []
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

export default async function NovelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, chapters, characters] = await Promise.all([getNovel(id), getChapters(id), getCharacters(id)])

  if (!novel) notFound()

  const sorted = [...chapters].sort((a, b) => a.number - b.number)

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/novels"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← All novels
        </Link>

        <div className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{novel.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[novel.status]}`}
            >
              {STATUS_LABELS[novel.status]}
            </span>
          </div>
          {novel.author && (
            <p className="mb-3 text-sm text-gray-400">by {novel.author}</p>
          )}
          {novel.description && (
            <p className="text-sm leading-relaxed text-gray-300">{novel.description}</p>
          )}
        </div>

        <div className="mb-6 flex gap-4">
          <Link
            href={`/novels/${id}/characters`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Characters
            <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
              {characters.length}
            </span>
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-200">Chapters</h2>
          <AddChapterForm novelId={id} />
        </div>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No chapters yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {sorted.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/novels/${id}/chapters/${chapter.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-900"
                >
                  <span className="text-sm text-white">
                    Ch. {chapter.number} — {chapter.title}
                  </span>
                  {chapter.read_at && (
                    <span className="text-xs text-gray-500">{chapter.read_at}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
