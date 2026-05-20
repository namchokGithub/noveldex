import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Character } from '../../../../types'
import CharacterDetail from './CharacterDetail'

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
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/novels/${id}/characters`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← Characters
        </Link>

        <CharacterDetail character={character} novelId={id} />
      </div>
    </main>
  )
}
