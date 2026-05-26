'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  normalizeDateTimeLocalToISOString,
  primaryButtonClassName,
  smallLabelClassName,
} from '../ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddChapterForm({
  novelId,
  volumeId,
}: {
  novelId: string
  volumeId: string
}) {
  const { t } = useI18n()
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
      read_at: normalizeDateTimeLocalToISOString(readAtRaw),
    }

    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }

      form.reset()
      setOpen(false)
      router.refresh()
    } catch {
      setError(t('common.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryButtonClassName}>
        {t('addChapter.button')}
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            {t('addChapter.eyebrow')}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            {t('addChapter.title')}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>{t('addChapter.numberRequired')}</label>
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
            <label className={smallLabelClassName}>{t('common.titleRequired')}</label>
            <input
              name="title"
              required
              className={inputClassName}
              placeholder={t('addChapter.chapterTitlePlaceholder')}
            />
          </div>
          <div>
            <label className={smallLabelClassName}>{t('addChapter.summary')}</label>
            <textarea
              name="summary"
              rows={3}
              className={inputClassName}
              placeholder={t('addChapter.summaryPlaceholder')}
            />
          </div>
          <div>
            <label className={smallLabelClassName}>{t('addChapter.dateRead')}</label>
            <input
              name="read_at"
              type="datetime-local"
              step={60}
              className={inputClassName}
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className={ghostButtonClassName}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className={primaryButtonClassName}>
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
