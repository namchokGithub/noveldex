'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import type {
  SearchChapterResult,
  SearchCharacterResult,
  SearchEventResult,
  SearchResult,
} from '@/app/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

type SearchSection = 'chapters' | 'characters' | 'events'

type SearchItem =
  | { section: 'chapters'; id: string; href: string; data: SearchChapterResult }
  | { section: 'characters'; id: string; href: string; data: SearchCharacterResult }
  | { section: 'events'; id: string; href: string; data: SearchEventResult }

const SECTION_LABELS: Record<SearchSection, string> = {
  chapters: 'CHAPTERS',
  characters: 'CHARACTERS',
  events: 'EVENTS',
}

const EMPTY_RESULTS: SearchResult = {
  chapters: [],
  characters: [],
  events: [],
}

function getNovelIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'novels' || !parts[1]) return null
  return parts[1]
}

export default function SearchPalette() {
  const pathname = usePathname()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const novelId = getNovelIdFromPath(pathname)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [fetchedResults, setFetchedResults] = useState<SearchResult>(EMPTY_RESULTS)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const trimmedQuery = query.trim()
  const results =
    isOpen && novelId && trimmedQuery.length >= 2 ? fetchedResults : EMPTY_RESULTS

  const items = useMemo<SearchItem[]>(() => {
    if (!novelId) return []
    return [
      ...results.chapters.map((chapter) => ({
        section: 'chapters' as const,
        id: chapter.id,
        href: `/novels/${novelId}/chapters/${chapter.id}`,
        data: chapter,
      })),
      ...results.characters.map((character) => ({
        section: 'characters' as const,
        id: character.id,
        href: `/novels/${novelId}/characters/${character.id}`,
        data: character,
      })),
      ...results.events.map((event) => ({
        section: 'events' as const,
        id: event.id,
        href: `/novels/${novelId}/timeline#event-${event.id}`,
        data: event,
      })),
    ]
  }, [novelId, results])

  const sections = useMemo(() => {
    const groups: Record<SearchSection, number[]> = {
      chapters: [],
      characters: [],
      events: [],
    }
    items.forEach((item, index) => {
      groups[item.section].push(index)
    })
    return groups
  }, [items])

  function openPalette() {
    setIsOpen(true)
    setQuery('')
    setFetchedResults(EMPTY_RESULTS)
    setActiveIndex(0)
    setLoading(false)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (isOpen) {
          closePalette()
        } else {
          openPalette()
        }
        return
      }
      if (event.key === 'Escape') {
        closePalette()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !novelId || trimmedQuery.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: trimmedQuery, type: 'all' })
        const res = await fetch(`${BASE}/api/v1/novels/${novelId}/search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setFetchedResults(EMPTY_RESULTS)
          return
        }
        const body = await res.json()
        setFetchedResults((body.data as SearchResult) ?? EMPTY_RESULTS)
        setActiveIndex(0)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setFetchedResults(EMPTY_RESULTS)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [isOpen, novelId, trimmedQuery])

  function closePalette() {
    setIsOpen(false)
    setQuery('')
    setFetchedResults(EMPTY_RESULTS)
    setActiveIndex(0)
    setLoading(false)
  }

  const currentActiveIndex = items.length === 0 ? -1 : Math.min(activeIndex, items.length - 1)

  function navigateToItem(item: SearchItem) {
    router.push(item.href)
    closePalette()
  }

  function jumpSection(direction: 1 | -1) {
    const nonEmptySections = (Object.keys(sections) as SearchSection[]).filter(
      (section) => sections[section].length > 0,
    )
    if (nonEmptySections.length === 0) return

    const currentSection = items[currentActiveIndex]?.section ?? nonEmptySections[0]
    const currentIdx = Math.max(nonEmptySections.indexOf(currentSection), 0)
    const nextIdx = (currentIdx + direction + nonEmptySections.length) % nonEmptySections.length
    setActiveIndex(sections[nonEmptySections[nextIdx]][0] ?? 0)
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (items.length > 0) setActiveIndex((index) => (index + 1) % items.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (items.length > 0) setActiveIndex((index) => (index - 1 + items.length) % items.length)
      return
    }
    if (event.key === 'Enter') {
      if (items[currentActiveIndex]) {
        event.preventDefault()
        navigateToItem(items[currentActiveIndex])
      }
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      jumpSection(event.shiftKey ? -1 : 1)
    }
  }

  if (!isOpen) return null

  const hasResults = items.length > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 px-4 py-16"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Search palette"
    >
      <div
        className="mx-auto flex max-h-[60vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value
                setQuery(nextQuery)
                if (nextQuery.trim().length < 2) {
                  setLoading(false)
                  setActiveIndex(0)
                }
              }}
              onKeyDown={onInputKeyDown}
              placeholder={novelId ? 'Search chapters, characters...' : 'Open a novel to search'}
              disabled={!novelId}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {!novelId && (
            <p className="px-4 py-6 text-sm text-gray-500">Open a novel to search.</p>
          )}

          {novelId && trimmedQuery.length > 0 && trimmedQuery.length < 2 && (
            <p className="px-4 py-6 text-sm text-gray-500">Type at least 2 characters.</p>
          )}

          {novelId && loading && (
            <p className="px-4 py-6 text-sm text-gray-500">Searching…</p>
          )}

          {novelId && !loading && trimmedQuery.length >= 2 && !hasResults && (
            <p className="px-4 py-6 text-sm text-gray-500">No matches found.</p>
          )}

          {(Object.keys(SECTION_LABELS) as SearchSection[]).map((section) => {
            const sectionItems = items.filter((item) => item.section === section)
            if (sectionItems.length === 0) return null

            return (
              <section key={section} className="border-t border-gray-900 first:border-t-0">
                <h2 className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {SECTION_LABELS[section]}
                </h2>
                <ul>
                  {sectionItems.map((item) => {
                    const index = items.findIndex((entry) => entry.section === item.section && entry.id === item.id)
                    const active = index === currentActiveIndex

                    return (
                      <li key={`${item.section}-${item.id}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => navigateToItem(item)}
                          className={`w-full px-4 py-3 text-left ${active ? 'bg-gray-800' : 'hover:bg-gray-900'}`}
                        >
                          {item.section === 'chapters' && (
                            <>
                              <div className="text-sm font-medium text-white">
                                Ch.{String(item.data.number).padStart(2, '0')} · {item.data.title}
                              </div>
                              <p
                                className="mt-1 text-sm text-gray-400"
                                dangerouslySetInnerHTML={{ __html: item.data.summary_snippet }}
                              />
                            </>
                          )}
                          {item.section === 'characters' && (
                            <>
                              <div className="text-sm font-medium text-white">
                                {item.data.name}
                                <span className="ml-2 text-xs text-gray-500">{item.data.role}</span>
                              </div>
                              <p
                                className="mt-1 text-sm text-gray-400"
                                dangerouslySetInnerHTML={{ __html: item.data.description_snippet }}
                              />
                            </>
                          )}
                          {item.section === 'events' && (
                            <>
                              <div className="text-sm font-medium text-white">{item.data.title}</div>
                              <p className="mt-1 text-xs text-gray-500">
                                {item.data.story_date}
                                {item.data.description ? ` · ${item.data.description}` : ''}
                              </p>
                            </>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
