'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  smallLabelClassName,
} from '../ui'

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
        className={primaryButtonClassName}
      >
        Add chapter
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            Chapters
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            Add chapter
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>Number *</label>
            <input
              name="number"
              type="number"
              min={1}
              required
              className={inputClassName}
              placeholder="1"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Title *</label>
            <input
              name="title"
              required
              className={inputClassName}
              placeholder="Chapter title"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Summary</label>
            <textarea
              name="summary"
              rows={3}
              className={inputClassName}
              placeholder="Chapter summary"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Date Read</label>
            <input
              name="read_at"
              type="date"
              className={inputClassName}
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              className={ghostButtonClassName}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButtonClassName}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
