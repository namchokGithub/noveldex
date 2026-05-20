'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterWithCharacters, Tag } from '../../../../types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function ChapterEditor({
  chapter,
  novelId,
}: {
  chapter: ChapterWithCharacters
  novelId: string
}) {
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
      .map(c => c.name)
      .filter(n => n.toLowerCase().startsWith(typed.toLowerCase()))
    setSuggestion({ names, anchorText: match[0] })
  }

  function insertSuggestion(name: string) {
    if (!suggestion) return
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? summary.length
    const before = summary.slice(0, pos)
    const after = summary.slice(pos)
    const replaced = before.slice(0, before.length - suggestion.anchorText.length) + `[[${name}]]`
    setSummary(replaced + after)
    setSuggestion(null)
  }

  async function ensureTagListLoaded() {
    if (allTags.length > 0 || tagLoading) return
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
    } catch {
      setTagError('Network error. Please try again.')
    } finally {
      setTagLoading(false)
    }
  }

  async function createOrFindTag(name: string): Promise<Tag | null> {
    const normalized = name.trim()
    if (!normalized) return null

    const existing = allTags.find((tag) => tag.name.toLowerCase() === normalized.toLowerCase())
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
    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tag.id }),
    })
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
      setTagError(error instanceof Error ? error.message : 'Failed to add tag.')
    } finally {
      setTagSaving(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    setTagSaving(true)
    setTagError(null)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}/tags/${tagId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTagError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setTags((current) => current.filter((tag) => tag.id !== tagId))
    } catch {
      setTagError('Network error. Please try again.')
    } finally {
      setTagSaving(false)
    }
  }

  async function saveSummary() {
    setSummaryError(null)
    setSummarySaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}`,
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
      setSummaryError('Network error. Please try again.')
    } finally {
      setSummarySaving(false)
    }
  }

  async function saveReadAt() {
    setReadAtError(null)
    setReadAtSaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}`,
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
      setReadAtError('Network error. Please try again.')
    } finally {
      setReadAtSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Summary</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyUp={handleKeyUp}
            rows={6}
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="Chapter summary"
          />
          {suggestion && suggestion.names.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-gray-700 bg-gray-900 shadow-lg">
              {suggestion.names.map(name => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertSuggestion(name) }}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {summaryError && <p className="mt-1 text-sm text-red-400">{summaryError}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveSummary}
            disabled={summarySaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {summarySaving ? 'Saving…' : 'Save summary'}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Date Read</label>
        <input
          type="date"
          value={readAt}
          onChange={(e) => setReadAt(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
        {readAtError && <p className="mt-1 text-sm text-red-400">{readAtError}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveReadAt}
            disabled={readAtSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {readAtSaving ? 'Saving…' : 'Save date'}
          </button>
        </div>
      </div>

      {/* Characters panel */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Characters</h2>
        {chapter.characters.length === 0 ? (
          <p className="text-sm text-gray-500">No characters linked yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {chapter.characters.map(char => (
              <li key={char.id}>
                <a
                  href={`/novels/${novelId}/characters/${char.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-200 hover:bg-gray-700"
                >
                  {char.name}
                  <span className="text-xs text-gray-500">{char.role}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Tags</h2>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-800"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={tagSaving}
                className="text-purple-700 hover:text-purple-900 disabled:opacity-50"
                aria-label={`Remove ${tag.name}`}
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
              className="rounded-full border border-dashed border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:border-gray-500 hover:text-white"
            >
              + Add tag
            </button>
          ) : (
            <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-3">
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
                placeholder="Add tag"
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-2 max-h-40 overflow-y-auto">
                {tagLoading && <p className="text-xs text-gray-500">Loading tags…</p>}
                {!tagLoading && filteredTagOptions.length > 0 && (
                  <ul className="space-y-1">
                    {filteredTagOptions.map((tag) => (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => void handleAddTag(tag.name)}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          {tag.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!tagLoading && filteredTagOptions.length === 0 && (
                  <p className="text-xs text-gray-500">
                    {tagQuery.trim() ? 'Press Enter to create this tag.' : 'No more tags available.'}
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
                  className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  disabled={tagSaving || !tagQuery.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
        {tagError && <p className="mt-2 text-sm text-red-400">{tagError}</p>}
      </div>
    </div>
  )
}
