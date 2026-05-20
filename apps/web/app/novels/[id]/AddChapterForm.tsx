'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddChapterForm({ novelId }: { novelId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const readAtRaw = (form.elements.namedItem('read_at') as HTMLInputElement).value
    const data = {
      number: Number((form.elements.namedItem('number') as HTMLInputElement).value),
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      summary: (form.elements.namedItem('summary') as HTMLTextAreaElement).value,
      read_at: readAtRaw || null,
    }

    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }

      form.reset()
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none"
      >
        Add Chapter
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Add Chapter</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Number *</label>
            <input
              name="number"
              type="number"
              min={1}
              required
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="1"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Title *</label>
            <input
              name="title"
              required
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="Chapter title"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Summary</label>
            <textarea
              name="summary"
              rows={3}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="Chapter summary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Date Read</label>
            <input
              name="read_at"
              type="date"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
