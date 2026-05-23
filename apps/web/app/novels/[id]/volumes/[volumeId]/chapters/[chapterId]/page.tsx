import Link from 'next/link'
import { notFound } from 'next/navigation'
import ChapterEditor from './ChapterEditor'
import LinkedCharactersPanel from './LinkedCharactersPanel'
import SummaryRenderer from './SummaryRenderer'
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  SectionHeading,
} from '@/app/novels/ui'
import { T } from '@/components/i18n/I18nProvider'
import { getChapter } from '@/libs/api'

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; chapterId: string }>
}) {
  const { id, volumeId, chapterId } = await params

  let chapter

  try {
    chapter = await getChapter(id, volumeId, chapterId)
  } catch {
    notFound()
  }

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

        <div className={cardClassName}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            Preview
          </h2>
          <SummaryRenderer
            summary={chapter.summary}
            novelId={id}
            characters={chapter.characters}
          />
        </div>

        <div className={cardClassName}>
          <LinkedCharactersPanel characters={chapter.characters} novelId={id} />
        </div>

        <ChapterEditor chapter={chapter} novelId={id} volumeId={volumeId} />
      </div>
    </DashboardPage>
  )
}
