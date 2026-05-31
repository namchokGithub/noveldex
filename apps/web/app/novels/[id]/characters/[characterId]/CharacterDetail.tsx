'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Character, CharacterRole } from '../../../../types'
import {
  cardClassName,
  ghostButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  roleColorClassNames,
  Snackbar,
  secondaryButtonClassName,
  smallLabelClassName,
} from '../../../ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function CharacterDetail({
  character,
  novelId,
  roles,
}: {
  character: Character
  novelId: string
  roles: CharacterRole[]
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const [name, setName] = useState(character.name)
  const [roleId, setRoleId] = useState(character.role_id)
  const [profileImageUrl, setProfileImageUrl] = useState(character.profile_image_url ?? '')
  const [description, setDescription] = useState(character.description)
  const [aliases, setAliases] = useState(character.aliases.join(', '))

  useEffect(() => {
    if (!snackbar) return
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [snackbar])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/characters/${character.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            role_id: roleId,
            profile_image_url: profileImageUrl.trim() || null,
            description,
            aliases: aliases ? aliases.split(',').map(s => s.trim()).filter(Boolean) : [],
          }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = body.error ?? `Request failed: ${res.status}`
        setError(message)
        setSnackbar({ tone: 'error', message })
        return
      }
      setEditing(false)
      setSnackbar({ tone: 'success', message: t('character.saveSuccess') })
      router.refresh()
    } catch {
      const message = t('common.networkError')
      setError(message)
      setSnackbar({ tone: 'error', message })
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setName(character.name)
    setRoleId(character.role_id)
    setProfileImageUrl(character.profile_image_url ?? '')
    setDescription(character.description)
    setAliases(character.aliases.join(', '))
    setEditing(false)
    setError(null)
  }

  const displayRole = character.role_name ?? character.role

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <CharacterAvatar
              name={character.name}
              profileImageUrl={character.profile_image_url}
              size="lg"
            />
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                {t('character.profile')}
              </div>
              {editing ? (
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={`${inputClassName} text-2xl font-semibold tracking-[-0.04em]`}
                />
              ) : (
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                  {character.name}
                </h1>
              )}
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={cancel} className={ghostButtonClassName}>
                {t('common.cancel')}
              </button>
              <button onClick={save} disabled={saving} className={primaryButtonClassName}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className={secondaryButtonClassName}>
              {t('common.edit')}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className={cardClassName}>
          <p className={smallLabelClassName}>{t('character.role')}</p>
          {editing ? (
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className={inputClassName}
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleColorClassNames[character.role] ?? roleColorClassNames.minor}`}
            >
              {displayRole}
            </span>
          )}

          <div className="mt-6 border-t border-stone-200 pt-5">
            <p className={smallLabelClassName}>{t('character.chapterAppearances')}</p>
            <p className="text-3xl font-semibold tracking-tighter text-stone-950">
              {character.chapter_count}
            </p>
          </div>
        </div>

        <div className={`${cardClassName} space-y-5`}>
          {editing && (
            <div>
              <label className={smallLabelClassName}>{t('addCharacter.profileImageUrl')}</label>
              <input
                value={profileImageUrl}
                onChange={e => setProfileImageUrl(e.target.value)}
                type="url"
                placeholder="https://example.com/image.jpg"
                className={inputClassName}
              />
            </div>
          )}

          <div>
            <p className={smallLabelClassName}>{t('character.aliases')}</p>
            {editing ? (
              <input
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                placeholder={t('addCharacter.aliasesPlaceholder')}
                className={inputClassName}
              />
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                {character.aliases.length > 0
                  ? character.aliases.join(', ')
                  : <span className="text-stone-400">{t('common.none')}</span>}
              </p>
            )}
          </div>

          <div>
            <p className={smallLabelClassName}>{t('common.description')}</p>
            {editing ? (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className={inputClassName}
                placeholder={t('addCharacter.descriptionPlaceholder')}
              />
            ) : (
              <p className="text-sm leading-7 text-stone-600">
                {character.description || <span className="text-stone-400">{t('character.noDescription')}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {character.chapters && character.chapters.length > 0 && (
        <div className={cardClassName}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t('character.appearsIn', { count: character.chapter_count })}
          </h2>
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {character.chapters.map(ch => (
              <li key={ch.id}>
                <Link
                  href={`/novels/${novelId}/volumes/${ch.volume_id}/chapters/${ch.id}`}
                  className={listRowClassName}
                >
                  <span className="text-sm font-medium text-stone-900">
                    Ch. {ch.number} — {ch.title}
                  </span>
                  {ch.read_at && (
                    <span className="text-xs text-stone-500">{ch.read_at}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t('common.ok')}
      />
    </div>
  )
}

function CharacterAvatar({
  name,
  profileImageUrl,
  size = 'md',
}: {
  name: string
  profileImageUrl: string | null
  size?: 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'lg'
    ? 'h-16 w-16 rounded-3xl text-base'
    : 'h-11 w-11 rounded-2xl text-sm'

  if (profileImageUrl && !failed) {
    return (
      <Image
        src={profileImageUrl}
        alt={name}
        width={size === 'lg' ? 64 : 44}
        height={size === 'lg' ? 64 : 44}
        onError={() => setFailed(true)}
        className={`shrink-0 object-cover ${sizeClass}`}
        unoptimized
      />
    )
  }

  return (
    <div className={`flex shrink-0 items-center justify-center bg-stone-900 font-semibold text-stone-50 ${sizeClass}`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
