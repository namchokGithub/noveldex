import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Character } from '../../../../types'
import CharacterDetail from './CharacterDetail'
import { backLinkClassName, DashboardPage } from '../../../ui'
import { T } from '@/components/i18n/I18nProvider'

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

async function getCharacter(novelId: string, characterId: string): Promise<Character | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/characters/${characterId}`,
      { cache: 'no-store' }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return body.data as Character
  } catch {
    return null
  }
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}) {
  const { id, characterId } = await params

  const [novel, character] = await Promise.all([getNovel(id), getCharacter(id, characterId)])

  if (!novel || !character) notFound()

  return (
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link
          href={`/novels/${id}/characters`}
          className={backLinkClassName}
        >
          ← <T k="nav.characters" />
        </Link>

        <CharacterDetail character={character} novelId={id} />
      </div>
    </DashboardPage>
  )
}
