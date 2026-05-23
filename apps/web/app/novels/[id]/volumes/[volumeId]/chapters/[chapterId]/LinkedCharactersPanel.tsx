import Link from 'next/link'
import { Character } from '@/app/types'
import { chipClassName } from '@/app/novels/ui'
import { T } from '@/components/i18n/I18nProvider'

interface Props {
  characters: Character[]
  novelId: string
}

export default function LinkedCharactersPanel({ characters, novelId }: Props) {
  if (characters.length === 0) {
    return <p className="text-sm text-stone-500"><T k="chapter.noLinkedCharacters" /></p>
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
        <T k="chapter.characters" />
      </h2>
      <ul className="flex flex-wrap gap-2">
        {characters.map((char) => (
          <li key={char.id}>
            <Link
              href={`/novels/${novelId}/characters/${char.id}`}
              className={chipClassName}
            >
              {char.name}
              <span className="text-[11px] text-stone-500">{char.role}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
