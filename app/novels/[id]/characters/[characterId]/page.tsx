import Link from 'next/link'
import { notFound } from 'next/navigation'
import CharacterDetail from './CharacterDetail'
import { backLinkClassName, DashboardPage } from '../../../ui'
import { T } from '@/components/i18n/I18nProvider'
import { getCharacter, getCharacterRoles, getNovel } from '@/libs/api'

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}) {
  const { id, characterId } = await params

  let character: Awaited<ReturnType<typeof getCharacter>>
  let roles: Awaited<ReturnType<typeof getCharacterRoles>>

  try {
    // getNovel is fetched (and awaited) solely to 404 when the parent novel is gone.
    [, character, roles] = await Promise.all([
      getNovel(id),
      getCharacter(id, characterId),
      getCharacterRoles(),
    ])
  } catch {
    notFound()
  }

  return (
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link
          href={`/novels/${id}/characters`}
          className={backLinkClassName}
        >
          ← <T k="nav.characters" />
        </Link>

        <CharacterDetail character={character} novelId={id} roles={roles} />
      </div>
    </DashboardPage>
  )
}
