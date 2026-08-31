import Link from 'next/link'
import { Character } from '@/app/types'
import { chipClassName } from '@/app/novels/ui'
import { T } from '@/components/i18n/I18nProvider'

interface Props {
  characters: Character[]
  mentionedCharacterNames: string[]
  novelId: string
}

export default function LinkedCharactersPanel({ characters, mentionedCharacterNames, novelId }: Props) {
  if (mentionedCharacterNames.length === 0) {
    return <p className="text-sm text-stone-500"><T k="chapter.noLinkedCharacters" /></p>
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
        <T k="chapter.characters" />
      </h2>
      <ul className="flex flex-wrap gap-2">
        {mentionedCharacterNames.map((name) => {
          const char = characters.find((item) => item.name === name)
          return <li key={name}>{char ? <Link href={`/novels/${novelId}/characters/${char.id}`} className={chipClassName}>{char.name}<span className="text-[11px] text-stone-500">{char.role}</span></Link> : <span className={chipClassName}>{name}</span>}</li>
        })}
      </ul>
    </div>
  )
}
