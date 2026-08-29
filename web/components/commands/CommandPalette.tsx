'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useI18n } from '@/components/i18n/I18nProvider'
import { getAllCharacters, getChaptersFlat, getEvents, getNovels } from '@/libs/api'

const OPEN_EVENT = 'noveldex:open-command-palette'
export const CHAPTER_SEARCH_SOURCE_EVENT = 'noveldex:chapter-search-source'

type Command = { id: string; label: string; hint: string; href?: string; keywords: string; onSelect?: () => void }
export type ChapterSearchSource = {
  title: string
  summary: string
  focusMatch: (field: 'title' | 'summary', start: number, length: number) => void
}

function currentNovelId(pathname: string) { return pathname.match(/^\/novels\/([^/]+)/)?.[1] ?? null }
function isChapterPage(pathname: string) { return /^\/novels\/[^/]+\/volumes\/[^/]+\/chapters\/[^/]+/.test(pathname) }
function excerpt(value: string, start: number, length: number) {
  const before = Math.max(0, start - 36), after = Math.min(value.length, start + length + 48)
  return `${before > 0 ? '…' : ''}${value.slice(before, after)}${after < value.length ? '…' : ''}`
}
function matchesIn(value: string, query: string) {
  const results: number[] = []; const needle = query.toLocaleLowerCase(); const haystack = value.toLocaleLowerCase()
  if (!needle) return results
  let start = 0
  while (start < haystack.length) { const index = haystack.indexOf(needle, start); if (index < 0) break; results.push(index); start = index + Math.max(needle.length, 1) }
  return results
}
function requestChapterSource(): ChapterSearchSource | null {
  let source: ChapterSearchSource | null = null
  window.dispatchEvent(new CustomEvent<(next: ChapterSearchSource) => void>(CHAPTER_SEARCH_SOURCE_EVENT, { detail: (next) => { source = next } }))
  return source
}

export function CommandPaletteTrigger() {
  const { t } = useI18n()
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-left text-sm text-stone-500 shadow-sm transition hover:border-stone-300 hover:bg-white"><span><span className="block font-medium text-stone-700">{t('novels.quickSearch')}</span><span className="block text-xs text-stone-500">{t('novels.quickSearchHelp')}</span></span><kbd className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600">Ctrl ⇧ K</kbd></button>
}

export default function CommandPalette() {
  const { t } = useI18n(); const pathname = usePathname(); const router = useRouter(); const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [entityCommands, setEntityCommands] = useState<Command[]>([]), [chapterSource, setChapterSource] = useState<ChapterSearchSource | null>(null)
  const chapterPage = isChapterPage(pathname); const novelId = currentNovelId(pathname)
  const navigationCommands = useMemo<Command[]>(() => chapterPage ? [] : [
    ...(novelId ? [{ id: 'overview', label: t('command.novelOverview'), hint: t('command.novelOverviewHint'), href: `/novels/${novelId}`, keywords: 'novel overview home' }, { id: 'characters', label: t('command.characters'), hint: t('command.charactersHint'), href: `/novels/${novelId}/characters`, keywords: 'characters cast people ตัวละคร' }, { id: 'timeline', label: t('command.timeline'), hint: t('command.timelineHint'), href: `/novels/${novelId}/timeline`, keywords: 'timeline events story เหตุการณ์' }] : []),
    { id: 'novels', label: t('command.allNovels'), hint: t('command.allNovelsHint'), href: '/novels', keywords: 'novels library dashboard นิยาย' },
  ], [chapterPage, novelId, t])

  useEffect(() => {
    if (chapterPage) return
    let active = true
    void (async () => {
      const novels = await getNovels()
      const data = await Promise.all(novels.map(async (novel) => ({ novel, results: await Promise.all([getAllCharacters(novel.id), getChaptersFlat(novel.id), getEvents(novel.id)]) })))
      return data.flatMap(({ novel, results: [characters, chapters, events] }) => {
        const names = new Map(characters.map((character) => [character.id, `${character.name} ${character.aliases.join(' ')}`]))
        return [
          { id: `novel:${novel.id}`, label: novel.title, hint: t('command.novelResult'), href: `/novels/${novel.id}`, keywords: `${novel.title} ${novel.author} ${novel.description} novel นิยาย` },
          ...characters.map((character) => ({ id: `character:${novel.id}:${character.id}`, label: character.name, hint: `${t('command.characterResult')} · ${novel.title}`, href: `/novels/${novel.id}/characters/${character.id}`, keywords: `${character.name} ${character.aliases.join(' ')} ${character.description} character ตัวละคร` })),
          ...chapters.map((chapter) => ({ id: `chapter:${novel.id}:${chapter.id}`, label: chapter.title, hint: `${t('command.chapterResult')} ${chapter.number} · ${novel.title}`, href: `/novels/${novel.id}/volumes/${chapter.volume_id}/chapters/${chapter.id}`, keywords: `${chapter.title} ${chapter.summary ?? ''} chapter บท ${chapter.number} ${(chapter.character_ids ?? []).map((id) => names.get(id) ?? '').join(' ')}` })),
          ...events.map((event) => ({ id: `event:${novel.id}:${event.id}`, label: event.title, hint: `${t('command.eventResult')} · ${novel.title}`, href: `/novels/${novel.id}/timeline#event-${event.id}`, keywords: `${event.title} ${event.description} event timeline เหตุการณ์` })),
        ]
      })
    })().then((next) => { if (active) setEntityCommands(next) }).catch(() => { if (active) setEntityCommands([]) })
    return () => { active = false }
  }, [chapterPage, t])

  const localCommands = useMemo<Command[]>(() => {
    if (!chapterPage || !chapterSource || !query.trim()) return []
    const term = query.trim(); const items: Command[] = []
    for (const start of matchesIn(chapterSource.title, term)) items.push({ id: `title:${start}`, label: chapterSource.title, hint: `${t('command.matchInTitle')} · ${excerpt(chapterSource.title, start, term.length)}`, keywords: chapterSource.title, onSelect: () => chapterSource.focusMatch('title', start, term.length) })
    for (const start of matchesIn(chapterSource.summary, term)) items.push({ id: `summary:${start}`, label: t('command.matchInSummary'), hint: excerpt(chapterSource.summary, start, term.length), keywords: chapterSource.summary, onSelect: () => chapterSource.focusMatch('summary', start, term.length) })
    return items
  }, [chapterPage, chapterSource, query, t])
  const matches = useMemo(() => {
    if (chapterPage) return localCommands
    const term = query.trim().toLocaleLowerCase(); const all = [...navigationCommands, ...entityCommands]
    if (!term) return navigationCommands
    return all.filter((command) => `${command.label} ${command.hint} ${command.keywords}`.toLocaleLowerCase().includes(term)).map((command) => command.id.startsWith('chapter:') ? { ...command, href: `${command.href}?find=${encodeURIComponent(query.trim())}` } : command)
  }, [chapterPage, entityCommands, localCommands, navigationCommands, query])

  function openPalette() { setQuery(''); setChapterSource(chapterPage ? requestChapterSource() : null); setOpen(true) }
  useEffect(() => { const listener = () => openPalette(); const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLocaleLowerCase() === 'k') { event.preventDefault(); openPalette() } if (event.key === 'Escape') setOpen(false) }; window.addEventListener(OPEN_EVENT, listener); window.addEventListener('keydown', key); return () => { window.removeEventListener(OPEN_EVENT, listener); window.removeEventListener('keydown', key) } })
  useEffect(() => { if (!open) return; const frame = window.requestAnimationFrame(() => inputRef.current?.focus()); return () => window.cancelAnimationFrame(frame) }, [open])
  function select(command: Command) { setOpen(false); if (command.onSelect) command.onSelect(); else if (command.href) router.push(command.href) }
  const placeholder = chapterPage ? t('command.chapterPlaceholder') : t('command.placeholder')
  const empty = chapterPage ? t('command.noChapterMatches') : t('command.noMatches')
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/25 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label={t('command.ariaLabel')} className="w-full max-w-xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="border-b border-stone-200 p-3"><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) select(matches[0]) }} placeholder={placeholder} className="w-full rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none ring-stone-900/20 placeholder:text-stone-400 focus:ring-2" /></div><div className="max-h-80 overflow-y-auto p-2">{matches.length === 0 ? <p className="px-3 py-8 text-center text-sm text-stone-500">{empty}</p> : matches.map((command) => <button key={command.id} type="button" onClick={() => select(command)} className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left hover:bg-stone-100"><span><span className="block text-sm font-medium text-stone-900">{command.label}</span><span className="mt-0.5 block text-xs text-stone-500">{command.hint}</span></span><span aria-hidden="true" className="text-stone-400">→</span></button>)}</div><div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">{t('command.hint')}</div></div></div>
}
