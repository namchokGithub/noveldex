'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  FormError,
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
import { useAuth } from '@/components/auth/AuthProvider'
import type { ChapterKind } from '@/app/types'
import { CHAPTER_KINDS } from '@/libs/chapterLabel'
import { userErrorMessage } from '@/libs/userErrorMessage'
import { normalizeChapter } from '@/libs/search/normalize'
import { useSearchIndex } from '@/libs/search/SearchIndexProvider'
import { useChapterKindLabels } from '@/components/chapters/ChapterLabel'

export default function AddChapterForm({
  novelId,
  volumeId,
}: {
  novelId: string
  volumeId: string
}) {
  const { t } = useI18n()
  const { entityMap, upsert } = useSearchIndex()
  const { isAdmin } = useAuth()
  const kindLabels = useChapterKindLabels()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [nextNumber, setNextNumber] = useState<number | null>(null)
  const [fetchingNumber, setFetchingNumber] = useState(false)
  const [kind, setKind] = useState<ChapterKind>('chapter')
  const [customLabel, setCustomLabel] = useState('')

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
      const nos = await getLastOrderNos({ novel_id: novelId, volume_id: volumeId })
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
      kind,
      number: kind === 'chapter' ? Number((form.elements.namedItem('number') as HTMLInputElement).value) : null,
      custom_label: kind === 'other' ? customLabel : null,
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      read_at: normalizeDateTimeLocalToISOString(readAtRaw),
    }

    try {
      const chapter = await createChapter(novelId, volumeId, data)
      upsert(normalizeChapter(novelId, chapter, entityMap, kindLabels))
      form.reset()
      setNextNumber(null)
      setKind('chapter')
      setCustomLabel('')
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addChapter.success') })
      router.refresh()
    } catch (err) {
      const message = userErrorMessage(err, t)
      setError(message)
      setSnackbar({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdmin) return null

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
                <label className={smallLabelClassName}>{t('addChapter.entryType')}</label>
                <select value={kind} onChange={(event) => setKind(event.target.value as ChapterKind)} className={inputClassName}>
                  {CHAPTER_KINDS.map((entryKind) => <option key={entryKind} value={entryKind}>{t(`chapter.kind.${entryKind === 'side_story' ? 'sideStory' : entryKind}` as 'chapter.kind.chapter')}</option>)}
                </select>
              </div>
              {kind === 'chapter' && <div>
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
              </div>}
              {kind === 'other' && <div>
                <label className={smallLabelClassName}>{t('addChapter.customLabel')}</label>
                <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} required maxLength={80} className={inputClassName} placeholder={t('addChapter.customLabelPlaceholder')} />
              </div>}
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
                <label className={smallLabelClassName}>{t('common.description')}</label>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={500}
                  className={inputClassName}
                  placeholder={t('chapter.descriptionPlaceholder')}
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
              {error && <FormError>{error}</FormError>}
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setError(null)
                    setNextNumber(null)
                    setKind('chapter')
                    setCustomLabel('')
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
