'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  Snackbar,
  smallLabelClassName,
} from './ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddNovelForm() {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!snackbar) return

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [snackbar])

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
        const message = body.error ?? `Request failed: ${res.status}`
        setError(message)
        setSnackbar({ tone: 'error', message })
        return
      }

      form.reset()
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addNovel.success') })
      router.refresh()
    } catch {
      const message = t('common.networkError')
      setError(message)
      setSnackbar({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={primaryButtonClassName}
        >
          {t('addNovel.button')}
        </button>
      ) : (
        <div className={modalBackdropClassName}>
          <div className={modalPanelClassName}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t('addNovel.eyebrow')}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {t('addNovel.title')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className={smallLabelClassName}>{t('common.titleRequired')}</label>
                <input
                  name="title"
                  required
                  className={inputClassName}
                  placeholder={t('addNovel.titlePlaceholder')}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>{t('addNovel.author')}</label>
                <input
                  name="author"
                  className={inputClassName}
                  placeholder={t('addNovel.authorPlaceholder')}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>{t('addNovel.status')}</label>
                <select
                  name="status"
                  defaultValue="reading"
                  className={inputClassName}
                >
                  <option value="reading">{t('status.reading')}</option>
                  <option value="completed">{t('status.completed')}</option>
                  <option value="dropped">{t('status.dropped')}</option>
                  <option value="on_hold">{t('status.on_hold')}</option>
                </select>
              </div>
              <div>
                <label className={smallLabelClassName}>{t('common.description')}</label>
                <textarea
                  name="description"
                  rows={3}
                  className={inputClassName}
                  placeholder={t('addNovel.shortDescription')}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>{t('addNovel.coverUrl')}</label>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={primaryButtonClassName}
                >
                  {submitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t('common.ok')}
      />
    </>
  )
}
