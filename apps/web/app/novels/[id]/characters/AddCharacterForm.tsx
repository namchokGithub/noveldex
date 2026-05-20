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
} from '../../ui'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddCharacterForm({ novelId }: { novelId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const aliasesRaw = (form.elements.namedItem('aliases') as HTMLInputElement).value
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      role: (form.elements.namedItem('role') as HTMLSelectElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      aliases: aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    }

    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/characters`, {
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
        Add character
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            Characters
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            Add character
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>Name *</label>
            <input
              name="name"
              required
              className={inputClassName}
              placeholder="Character name"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Role</label>
            <select
              name="role"
              defaultValue="minor"
              className={inputClassName}
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="minor">Minor</option>
            </select>
          </div>
          <div>
            <label className={smallLabelClassName}>Aliases (comma-separated)</label>
            <input
              name="aliases"
              className={inputClassName}
              placeholder="Alias 1, Alias 2"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>Description</label>
            <textarea
              name="description"
              rows={3}
              className={inputClassName}
              placeholder="Character description"
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
