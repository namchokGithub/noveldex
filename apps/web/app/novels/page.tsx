import Link from 'next/link'
import type { Novel } from '../types'
import AddNovelForm from './AddNovelForm'

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

async function getNovels(): Promise<Novel[] | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    return body.data as Novel[]
  } catch {
    return null
  }
}

export default async function NovelsPage() {
  const novels = await getNovels()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">NovelDex</h1>
          <AddNovelForm />
        </div>

        {novels === null ? (
          <p className="text-red-400">Failed to load novels. Check that the API is running.</p>
        ) : novels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="mb-2 text-lg text-gray-400">No novels yet.</p>
            <p className="text-sm text-gray-600">Add your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {novels.map((novel) => (
              <Link
                key={novel.id}
                href={`/novels/${novel.id}`}
                className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700 hover:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold leading-snug text-white">{novel.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[novel.status]}`}
                  >
                    {STATUS_LABELS[novel.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{novel.author || '—'}</p>
                {novel.description && (
                  <p className="line-clamp-2 text-xs text-gray-400">{novel.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
