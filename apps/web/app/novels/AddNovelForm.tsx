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
} from './ui'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddNovelForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const data = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      author: (form.elements.namedItem('author') as HTMLInputElement).value,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      cover_url: (form.elements.namedItem('cover_url') as HTMLInputElement).value,
    }

    try {
      const res = await fetch(`${BASE}/api/v1/novels`, {
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
        Add novel
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            Library
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            Add novel
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>Title *</label>
            <input
              name="title"
              required
              className={inputClassName}
              placeholder="Novel title"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Author</label>
            <input
              name="author"
              className={inputClassName}
              placeholder="Author name"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Status</label>
            <select
              name="status"
              defaultValue="reading"
              className={inputClassName}
            >
              <option value="reading">Reading</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div>
            <label className={smallLabelClassName}>Description</label>
            <textarea
              name="description"
              rows={3}
              className={inputClassName}
              placeholder="Short description"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Cover URL</label>
            <input
              name="cover_url"
              type="url"
              className={inputClassName}
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
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
