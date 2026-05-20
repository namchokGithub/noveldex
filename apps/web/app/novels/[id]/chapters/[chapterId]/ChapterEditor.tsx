'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Chapter } from '../../../../types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function ChapterEditor({
  chapter,
  novelId,
}: {
  chapter: Chapter
  novelId: string
}) {
  const router = useRouter()

  const [summary, setSummary] = useState(chapter.summary ?? '')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarySaving, setSummarySaving] = useState(false)

  const [readAt, setReadAt] = useState(chapter.read_at ?? '')
  const [readAtError, setReadAtError] = useState<string | null>(null)
  const [readAtSaving, setReadAtSaving] = useState(false)

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
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          placeholder="Chapter summary"
        />
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
    </div>
  )
}
