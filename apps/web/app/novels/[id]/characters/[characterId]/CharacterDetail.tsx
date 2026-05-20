'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Character } from '../../../../types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const ROLE_OPTIONS = ['protagonist', 'antagonist', 'supporting', 'minor']

const ROLE_COLORS: Record<string, string> = {
  protagonist: 'bg-blue-900 text-blue-300',
  antagonist: 'bg-red-900 text-red-300',
  supporting: 'bg-purple-900 text-purple-300',
  minor: 'bg-gray-800 text-gray-400',
}

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
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-2xl font-bold text-white focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{character.name}</h1>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={cancel}
              className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
          >
            Edit
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Role</p>
          {editing ? (
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[character.role] ?? 'bg-gray-800 text-gray-400'}`}
            >
              {character.role}
            </span>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Aliases</p>
          {editing ? (
            <input
              value={aliases}
              onChange={e => setAliases(e.target.value)}
              placeholder="Alias 1, Alias 2"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-gray-300">
              {character.aliases.length > 0 ? character.aliases.join(', ') : <span className="text-gray-600">None</span>}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Description</p>
          {editing ? (
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="Character description"
            />
          ) : (
            <p className="text-sm leading-relaxed text-gray-300">
              {character.description || <span className="text-gray-600">No description.</span>}
            </p>
          )}
        </div>
      </div>

      {character.chapters && character.chapters.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Appears in ({character.chapter_count})
          </h2>
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {character.chapters.map(ch => (
              <li key={ch.id}>
                <Link
                  href={`/novels/${novelId}/chapters/${ch.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-900"
                >
                  <span className="text-sm text-white">Ch. {ch.number} — {ch.title}</span>
                  {ch.read_at && (
                    <span className="text-xs text-gray-500">{ch.read_at}</span>
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
