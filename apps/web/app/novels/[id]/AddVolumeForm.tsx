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
import { createVolume } from '@/libs/api'

export default function AddVolumeForm({ novelId }: { novelId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const number = Number((form.elements.namedItem('number') as HTMLInputElement).value)
    const title = (form.elements.namedItem('title') as HTMLInputElement).value

    try {
      await createVolume(novelId, { number, title })
      form.reset()
      setOpen(false)
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryButtonClassName}>
        Add volume
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            Volume
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            Create volume
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>Number</label>
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
            <label className={smallLabelClassName}>Title</label>
            <input
              name="title"
              required
              className={inputClassName}
              placeholder="Volume 1"
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
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
