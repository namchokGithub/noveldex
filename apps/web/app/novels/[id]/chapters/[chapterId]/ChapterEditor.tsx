'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterWithCharacters } from '../../../../types'

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
    </div>
  )
}
