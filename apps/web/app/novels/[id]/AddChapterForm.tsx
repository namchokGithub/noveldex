'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  normalizeDateTimeLocalToISOString,
  primaryButtonClassName,
  Snackbar,
  smallLabelClassName,
} from '../ui'
import { useI18n } from '@/components/i18n/I18nProvider'
import { createChapter, getLastOrderNos } from '@/libs/api'

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
  const [snackbar, setSnackbar] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [nextNumber, setNextNumber] = useState<number | null>(null)
  const [fetchingNumber, setFetchingNumber] = useState(false)

  useEffect(() => {
    if (!snackbar) return

    const timeoutId = window.setTimeout(() => {
      setSnackbar(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [snackbar])

  async function handleOpenForm() {
    setFetchingNumber(true)
    try {
      const nos = await getLastOrderNos({ volume_id: volumeId })
      setNextNumber(nos.chapter + 1)
    } catch {
      setNextNumber(null) // silent fallback — user types manually
    } finally {
      setFetchingNumber(false)
      setOpen(true)
    }
  }

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
      await createChapter(novelId, volumeId, data)
      form.reset()
      setNextNumber(null)
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addChapter.success') })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.networkError')
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
          onClick={handleOpenForm}
          disabled={fetchingNumber}
          className={primaryButtonClassName}
        >
          {fetchingNumber ? t('common.loading') : t('addChapter.button')}
        </button>
      ) : (
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
                  defaultValue={nextNumber ?? undefined}
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
                    setNextNumber(null)
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
