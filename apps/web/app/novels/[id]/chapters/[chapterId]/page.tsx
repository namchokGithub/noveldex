import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ChapterWithCharacters } from '../../../../types'
import ChapterEditor from './ChapterEditor'
import { backLinkClassName, DashboardPage, SectionHeading } from '../../../ui'

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
    if (!data.tags) data.tags = []
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
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link
          href={`/novels/${id}`}
          className={backLinkClassName}
        >
          ← Back to novel
        </Link>

        <SectionHeading
          eyebrow={`Chapter ${chapter.number}`}
          title={chapter.title}
          description="Edit chapter summary, reading date, linked cast, and tags."
        />

        <ChapterEditor chapter={chapter} novelId={id} />
      </div>
    </DashboardPage>
  )
}
