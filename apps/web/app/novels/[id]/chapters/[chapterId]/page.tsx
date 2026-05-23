import { notFound, redirect } from 'next/navigation'
import { getChaptersByVolume, getVolumes } from '@/libs/api'

async function resolveChapterPath(novelId: string, chapterId: string) {
  const volumes = await getVolumes(novelId)

  for (const volume of volumes) {
    const chapters = await getChaptersByVolume(novelId, volume.id)
    const chapter = chapters.find((entry) => entry.id === chapterId)

    if (chapter) {
      return `/novels/${novelId}/volumes/${volume.id}/chapters/${chapter.id}`
    }
  }

  return null
}

export default async function LegacyChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params

  try {
    const nextPath = await resolveChapterPath(id, chapterId)

    if (!nextPath) {
      notFound()
    }

    redirect(nextPath)
  } catch {
    notFound()
  }
}
