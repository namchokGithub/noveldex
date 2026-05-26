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
} from '../../ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddCharacterForm({ novelId }: { novelId: string }) {
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
        const message = body.error ?? `Request failed: ${res.status}`
        setError(message)
        setSnackbar({ tone: 'error', message })
        return
      }

      form.reset()
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addCharacter.success') })
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
          {t('addCharacter.button')}
        </button>
      ) : (
        <div className={modalBackdropClassName}>
          <div className={modalPanelClassName}>
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                {t('addCharacter.eyebrow')}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                {t('addCharacter.title')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className={smallLabelClassName}>{t('addCharacter.nameRequired')}</label>
                <input
                  name="name"
                  required
                  className={inputClassName}
                  placeholder={t('addCharacter.namePlaceholder')}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>{t('addCharacter.role')}</label>
                <select
                  name="role"
                  defaultValue="minor"
                  className={inputClassName}
                >
                  <option value="protagonist">{t('role.protagonist')}</option>
                  <option value="antagonist">{t('role.antagonist')}</option>
                  <option value="supporting">{t('role.supporting')}</option>
                  <option value="minor">{t('role.minor')}</option>
                </select>
              </div>
              <div>
                <label className={smallLabelClassName}>{t('addCharacter.aliases')}</label>
                <input
                  name="aliases"
                  className={inputClassName}
                  placeholder={t('addCharacter.aliasesPlaceholder')}
                />
              </div>
              <div>
                <label className={smallLabelClassName}>{t('common.description')}</label>
                <textarea
                  name="description"
                  rows={3}
                  className={inputClassName}
                  placeholder={t('addCharacter.descriptionPlaceholder')}
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="mt-1 flex justify-end gap-2">
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
