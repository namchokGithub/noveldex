import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ChapterWithCharacters } from '@/app/types'
import ChapterEditor from './ChapterEditor'
import { backLinkClassName, DashboardPage, SectionHeading } from '@/app/novels/ui'
import { T } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string
): Promise<ChapterWithCharacters | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`,
      { cache: 'no-store' }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    const data = body.data as ChapterWithCharacters
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
  params: Promise<{ id: string; volumeId: string; chapterId: string }>
}) {
  const { id, volumeId, chapterId } = await params

  const chapter = await getChapter(id, volumeId, chapterId)
  if (!chapter) notFound()

  return (
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← <T k="nav.backToNovel" />
        </Link>

        <SectionHeading
          eyebrow={<T k="chapter.pageEyebrow" values={{ number: chapter.number }} />}
          title={chapter.title}
          description={<T k="chapter.pageDescription" />}
        />

        <ChapterEditor chapter={chapter} novelId={id} volumeId={volumeId} />
      </div>
    </DashboardPage>
  )
}
