'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Character } from '../../../../types'
import {
  cardClassName,
  ghostButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  roleColorClassNames,
  secondaryButtonClassName,
  smallLabelClassName,
} from '../../../ui'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const ROLE_OPTIONS = ['protagonist', 'antagonist', 'supporting', 'minor']

export default function CharacterDetail({
  character,
  novelId,
}: {
  character: Character
  novelId: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(character.name)
  const [role, setRole] = useState(character.role)
  const [description, setDescription] = useState(character.description)
  const [aliases, setAliases] = useState(character.aliases.join(', '))

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
            role,
            description,
            aliases: aliases ? aliases.split(',').map(s => s.trim()).filter(Boolean) : [],
          }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setName(character.name)
    setRole(character.role)
    setDescription(character.description)
    setAliases(character.aliases.join(', '))
    setEditing(false)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Character profile
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
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={cancel}
                className={ghostButtonClassName}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className={primaryButtonClassName}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={secondaryButtonClassName}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className={cardClassName}>
          <p className={smallLabelClassName}>Role</p>
          {editing ? (
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className={inputClassName}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleColorClassNames[character.role] ?? roleColorClassNames.minor}`}
            >
              {character.role}
            </span>
          )}

          <div className="mt-6 border-t border-stone-200 pt-5">
            <p className={smallLabelClassName}>Chapter appearances</p>
            <p className="text-3xl font-semibold tracking-[-0.05em] text-stone-950">
              {character.chapter_count}
            </p>
          </div>
        </div>

        <div className={`${cardClassName} space-y-5`}>
          <div>
            <p className={smallLabelClassName}>Aliases</p>
            {editing ? (
              <input
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                placeholder="Alias 1, Alias 2"
                className={inputClassName}
              />
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                {character.aliases.length > 0 ? character.aliases.join(', ') : <span className="text-stone-400">None</span>}
              </p>
            )}
          </div>

          <div>
            <p className={smallLabelClassName}>Description</p>
            {editing ? (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className={inputClassName}
                placeholder="Character description"
              />
            ) : (
              <p className="text-sm leading-7 text-stone-600">
                {character.description || <span className="text-stone-400">No description.</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {character.chapters && character.chapters.length > 0 && (
        <div className={cardClassName}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            Appears in ({character.chapter_count})
          </h2>
          <ul className={`${listClassName} divide-y divide-stone-200`}>
            {character.chapters.map(ch => (
              <li key={ch.id}>
                <Link
                  href={`/novels/${novelId}/chapters/${ch.id}`}
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
    </div>
  )
}
