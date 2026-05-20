import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Character } from '../../../types'
import AddCharacterForm from './AddCharacterForm'

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

async function getCharacters(novelId: string): Promise<Character[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/characters`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Character[]) ?? []
  } catch {
    return []
  }
}

const ROLE_COLORS: Record<string, string> = {
  protagonist: 'bg-blue-900 text-blue-300',
  antagonist: 'bg-red-900 text-red-300',
  supporting: 'bg-purple-900 text-purple-300',
  minor: 'bg-gray-800 text-gray-400',
}

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, characters] = await Promise.all([getNovel(id), getCharacters(id)])

  if (!novel) notFound()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/novels/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← {novel.title}
        </Link>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Characters</h1>
          <AddCharacterForm novelId={id} />
        </div>

        {characters.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No characters yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {characters.map((char) => (
              <li key={char.id}>
                <Link
                  href={`/novels/${id}/characters/${char.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{char.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[char.role] ?? 'bg-gray-800 text-gray-400'}`}
                    >
                      {char.role}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {char.chapter_count} {char.chapter_count === 1 ? 'chapter' : 'chapters'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
