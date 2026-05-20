import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Character } from '../../../types'
import AddCharacterForm from './AddCharacterForm'
import { T } from '@/components/i18n/I18nProvider'
import {
  backLinkClassName,
  DashboardPage,
  listClassName,
  listRowClassName,
  roleColorClassNames,
  SectionHeading,
} from '../../ui'

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

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, characters] = await Promise.all([getNovel(id), getCharacters(id)])

  if (!novel) notFound()

  return (
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link
          href={`/novels/${id}`}
          className={backLinkClassName}
        >
          ← {novel.title}
        </Link>

        <SectionHeading
          eyebrow={<T k="characters.eyebrow" />}
          title={<T k="characters.directoryTitle" />}
          description={<T k="characters.directoryDescription" />}
          action={<AddCharacterForm novelId={id} />}
        />

        {characters.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
            <T k="characters.noCharacters" />
          </div>
        ) : (
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {characters.map((char) => (
              <li key={char.id}>
                <Link
                  href={`/novels/${id}/characters/${char.id}`}
                  className={listRowClassName}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-stone-50">
                      {char.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-900">
                        {char.name}
                      </span>
                      {char.aliases.length > 0 ? (
                        <span className="mt-1 block truncate text-xs text-stone-500">
                          {char.aliases.join(', ')}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleColorClassNames[char.role] ?? roleColorClassNames.minor}`}
                    >
                      <T k={`role.${char.role}` as const} />
                    </span>
                  </div>
                  <span className="text-xs text-stone-500">
                    <T
                      k={char.chapter_count === 1 ? 'characters.chapter.one' : 'characters.chapter.other'}
                      values={{ count: char.chapter_count }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardPage>
  )
}
