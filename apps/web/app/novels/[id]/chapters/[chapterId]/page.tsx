import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ChapterWithCharacters } from '../../../../types'
import ChapterEditor from './ChapterEditor'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getChapter(novelId: string, chapterId: string): Promise<ChapterWithCharacters | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/chapters/${chapterId}`,
      { cache: 'no-store' }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    const data = body.data as ChapterWithCharacters
    // Ensure characters array is always present (API may omit it if empty)
    if (!data.characters) data.characters = []
    return data
  } catch {
    return null
  }
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params

  const chapter = await getChapter(id, chapterId)
  if (!chapter) notFound()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/novels/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← Back to novel
        </Link>

        <h1 className="mb-8 text-2xl font-bold tracking-tight">
          Ch. {chapter.number} — {chapter.title}
        </h1>

        <ChapterEditor chapter={chapter} novelId={id} />
      </div>
    </main>
  )
}
