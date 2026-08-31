'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Character } from '@/app/types'
import { chipClassName, modalBackdropClassName, modalPanelClassName, secondaryButtonClassName } from '@/app/novels/ui'
import { T, useI18n } from '@/components/i18n/I18nProvider'

interface Props {
  characters: Character[]
  mentionedCharacterNames: string[]
  novelId: string
}

export default function LinkedCharactersPanel({ characters, mentionedCharacterNames, novelId }: Props) {
  const { t } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)
  const [visibleCount, setVisibleCount] = useState(mentionedCharacterNames.length)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const list = listRef.current
    const container = list?.parentElement
    if (!container) return

    const updateVisibleCharacters = () => setVisibleCount(mentionedCharacterNames.length)
    updateVisibleCharacters()
    const observer = new ResizeObserver(updateVisibleCharacters)
    observer.observe(container)
    return () => observer.disconnect()
  }, [mentionedCharacterNames.length])

  useEffect(() => {
    const list = listRef.current
    if (!list || visibleCount === 0) return

    const chips = Array.from(list.querySelectorAll<HTMLElement>('[data-character-chip]'))
    const rows = [...new Set(chips.map((chip) => chip.offsetTop))]
    const firstHiddenIndex = chips.findIndex((chip) => chip.offsetTop > rows[2])

    if (firstHiddenIndex >= 0) {
      setVisibleCount(firstHiddenIndex)
      return
    }

    const overflowBadge = list.querySelector<HTMLElement>('[data-overflow-badge]')
    if (overflowBadge && overflowBadge.offsetTop > rows[2]) {
      setVisibleCount((count) => Math.max(0, count - 1))
    }
  }, [visibleCount])

  if (mentionedCharacterNames.length === 0) {
    return <p className="text-sm text-stone-500"><T k="chapter.noLinkedCharacters" /></p>
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
        <T k="chapter.characters" />
      </h2>
      <ul ref={listRef} className="flex flex-wrap gap-2">
        {mentionedCharacterNames.slice(0, visibleCount).map((name) => {
          const char = characters.find((item) => item.name === name)
          return <li key={name} data-character-chip>{char ? <Link href={`/novels/${novelId}/characters/${char.id}`} className={chipClassName}>{char.name}<span className="text-[11px] text-stone-500">{char.role}</span></Link> : <span className={chipClassName}>{name}</span>}</li>
        })}
        {visibleCount < mentionedCharacterNames.length && <li data-overflow-badge><button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center rounded-full bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-50 transition hover:bg-stone-700" aria-label={`Show ${mentionedCharacterNames.length - visibleCount} more characters`}>+{mentionedCharacterNames.length - visibleCount}</button></li>}
      </ul>
      {dialogOpen && <div className={modalBackdropClassName} onMouseDown={() => setDialogOpen(false)}><div role="dialog" aria-modal="true" aria-labelledby="all-characters-title" className={`${modalPanelClassName} max-w-lg`} onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500"><T k="chapter.characters" /></p><h3 id="all-characters-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-stone-950">{mentionedCharacterNames.length} <T k="chapter.characters" /></h3></div><button type="button" onClick={() => setDialogOpen(false)} className={secondaryButtonClassName}>{t('common.cancel')}</button></div><ul className="flex max-h-96 flex-wrap content-start gap-2 overflow-y-auto pr-1">{mentionedCharacterNames.map((name) => { const char = characters.find((item) => item.name === name); return <li key={name}>{char ? <Link href={`/novels/${novelId}/characters/${char.id}`} onClick={() => setDialogOpen(false)} className={chipClassName}>{char.name}<span className="text-[11px] text-stone-500">{char.role}</span></Link> : <span className={chipClassName}>{name}</span>}</li> })}</ul></div></div>}
    </div>
  )
}
