'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterWithCharacters, Tag } from '@/app/types'
import {
  cardClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
  tagClassName,
} from '@/app/novels/ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function ChapterEditor({
  chapter,
  novelId,
  volumeId,
}: {
  chapter: ChapterWithCharacters
  novelId: string
  volumeId: string
}) {
  const { t } = useI18n()
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [summary, setSummary] = useState(chapter.summary ?? '')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarySaving, setSummarySaving] = useState(false)

  const [readAt, setReadAt] = useState(chapter.read_at ?? '')
  const [readAtError, setReadAtError] = useState<string | null>(null)
  const [readAtSaving, setReadAtSaving] = useState(false)

  const [suggestion, setSuggestion] = useState<{ names: string[]; anchorText: string } | null>(null)
  const [tags, setTags] = useState<Tag[]>(chapter.tags ?? [])
  const [allTags, setAllTags] = useState<Tag[]>(chapter.tags ?? [])
  const [tagQuery, setTagQuery] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [tagListFetched, setTagListFetched] = useState(false)
  const [tagLoading, setTagLoading] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [tagSaving, setTagSaving] = useState(false)

  const filteredTagOptions = useMemo(() => {
    const linked = new Set(tags.map((tag) => tag.id))
    return allTags.filter((tag) => {
      if (linked.has(tag.id)) return false
      if (!tagQuery.trim()) return true
      return tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase())
    })
  }, [allTags, tagQuery, tags])

  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setSuggestion(null)
      return
    }
    const ta = e.currentTarget
    const before = ta.value.slice(0, ta.selectionStart ?? ta.value.length)
    const match = before.match(/\[\[([^\]]*)$/)
    if (!match) {
      setSuggestion(null)
      return
    }
    const typed = match[1]
    const names = chapter.characters
      .map((c) => c.name)
      .filter((n) => n.toLowerCase().startsWith(typed.toLowerCase()))
    setSuggestion({ names, anchorText: match[0] })
  }

  function insertSuggestion(name: string) {
    if (!suggestion) return
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? summary.length
    const before = summary.slice(0, pos)
    const after = summary.slice(pos)
    const replaced =
      before.slice(0, before.length - suggestion.anchorText.length) + `[[${name}]]`
    setSummary(replaced + after)
    setSuggestion(null)
  }

  async function ensureTagListLoaded() {
    if (tagListFetched || tagLoading) return
    setTagLoading(true)
    setTagError(null)
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/tags`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTagError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      const body = await res.json()
      setAllTags((body.data as Tag[]) ?? [])
      setTagListFetched(true)
    } catch {
      setTagError(t('common.networkError'))
    } finally {
      setTagLoading(false)
    }
  }

  async function createOrFindTag(name: string): Promise<Tag | null> {
    const normalized = name.trim()
    if (!normalized) return null

    const existing = allTags.find(
      (tag) => tag.name.toLowerCase() === normalized.toLowerCase()
    )
    if (existing) return existing

    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: normalized }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    const body = await res.json()
    const created = body.data as Tag
    setAllTags((current) => {
      if (current.some((tag) => tag.id === created.id)) return current
      return [...current, created].sort((a, b) => a.name.localeCompare(b.name))
    })
    return created
  }

  async function linkTag(tag: Tag) {
    if (tags.some((entry) => entry.id === tag.id)) return
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }
    setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleAddTag(name?: string) {
    const nextName = (name ?? tagQuery).trim()
    if (!nextName) return
    setTagSaving(true)
    setTagError(null)
    try {
      const tag = await createOrFindTag(nextName)
      if (!tag) return
      await linkTag(tag)
      setTagQuery('')
      setTagPickerOpen(false)
    } catch (error) {
      setTagError(error instanceof Error ? error.message : t('chapter.failedAddTag'))
    } finally {
      setTagSaving(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    setTagSaving(true)
    setTagError(null)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags/${tagId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTagError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setTags((current) => current.filter((tag) => tag.id !== tagId))
    } catch {
      setTagError(t('common.networkError'))
    } finally {
      setTagSaving(false)
    }
  }

  async function saveSummary() {
    setSummaryError(null)
    setSummarySaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSummaryError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      router.refresh()
    } catch {
      setSummaryError(t('common.networkError'))
    } finally {
      setSummarySaving(false)
    }
  }

  async function saveReadAt() {
    setReadAtError(null)
    setReadAtSaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read_at: readAt }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setReadAtError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      router.refresh()
    } catch {
      setReadAtError(t('common.networkError'))
    } finally {
      setReadAtSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={cardClassName}>
        <label className={smallLabelClassName}>{t('addChapter.summary')}</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyUp={handleKeyUp}
            rows={6}
            className={`${inputClassName} min-h-[180px]`}
            placeholder={t('addChapter.summaryPlaceholder')}
          />
          {suggestion && suggestion.names.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              {suggestion.names.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertSuggestion(name)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {summaryError && <p className="mt-2 text-sm text-rose-600">{summaryError}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveSummary}
            disabled={summarySaving}
            className={primaryButtonClassName}
          >
            {summarySaving ? t('common.saving') : t('chapter.saveSummary')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={cardClassName}>
          <label className={smallLabelClassName}>{t('addChapter.dateRead')}</label>
          <input
            type="date"
            value={readAt}
            onChange={(e) => setReadAt(e.target.value)}
            className={inputClassName}
          />
          {readAtError && <p className="mt-2 text-sm text-rose-600">{readAtError}</p>}
          <div className="mt-3 flex justify-end">
            <button
              onClick={saveReadAt}
              disabled={readAtSaving}
              className={primaryButtonClassName}
            >
              {readAtSaving ? t('common.saving') : t('chapter.saveDate')}
            </button>
          </div>
        </div>

        <div className={cardClassName}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t('chapter.characters')}
          </h2>
          {chapter.characters.length === 0 ? (
            <p className="text-sm text-stone-500">{t('chapter.noLinkedCharacters')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {chapter.characters.map((char) => (
                <li key={char.id}>
                  <a
                    href={`/novels/${novelId}/characters/${char.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200/70"
                  >
                    {char.name}
                    <span className="text-xs text-stone-500">{char.role}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClassName}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
          {t('chapter.tags')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className={tagClassName}>
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={tagSaving}
                className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
                aria-label={t('chapter.removeTag', { name: tag.name })}
              >
                ×
              </button>
            </span>
          ))}

          {!tagPickerOpen ? (
            <button
              type="button"
              onClick={async () => {
                setTagPickerOpen(true)
                await ensureTagListLoaded()
              }}
              className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900"
            >
              {t('chapter.addTag')}
            </button>
          ) : (
            <div className="w-full max-w-sm rounded-[22px] border border-stone-200 bg-stone-50/90 p-3 shadow-sm">
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddTag()
                  }
                  if (e.key === 'Escape') {
                    setTagPickerOpen(false)
                    setTagQuery('')
                  }
                }}
                placeholder={t('chapter.addTagPlaceholder')}
                className={inputClassName}
              />
              <div className="mt-2 max-h-40 overflow-y-auto">
                {tagLoading && (
                  <p className="text-xs text-stone-500">{t('chapter.loadingTags')}</p>
                )}
                {!tagLoading && filteredTagOptions.length > 0 && (
                  <ul className="space-y-1">
                    {filteredTagOptions.map((tag) => (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => void handleAddTag(tag.name)}
                          className="w-full rounded-xl px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-white"
                        >
                          {tag.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!tagLoading && filteredTagOptions.length === 0 && (
                  <p className="text-xs text-stone-500">
                    {tagQuery.trim() ? t('chapter.createTagHint') : t('chapter.noMoreTags')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTagPickerOpen(false)
                    setTagQuery('')
                  }}
                  className={secondaryButtonClassName}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  disabled={tagSaving || !tagQuery.trim()}
                  className={primaryButtonClassName}
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          )}
        </div>
        {tagError && <p className="mt-2 text-sm text-rose-600">{tagError}</p>}
      </div>
    </div>
  )
}
