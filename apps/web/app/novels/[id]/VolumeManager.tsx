'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Volume } from '@/app/types'
import AddChapterForm from './AddChapterForm'
import {
  cardClassName,
  ghostButtonClassName,
  iconButtonClassName,
  inputClassName,
  listClassName,
  listRowClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from '../ui'
import { deleteVolume, updateVolume } from '@/libs/api'

interface VolumeItem extends Volume {
  chapterCount: number
}

export default function VolumeManager({
  novelId,
  volumes,
}: {
  novelId: string
  volumes: VolumeItem[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startEdit(volume: VolumeItem) {
    setEditingId(volume.id)
    setNumber(String(volume.number))
    setTitle(volume.title)
    setError(null)
  }

  async function handleSave(volumeId: string) {
    setSaving(true)
    setError(null)

    try {
      await updateVolume(novelId, volumeId, {
        number: Number(number),
        title,
      })
      setEditingId(null)
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(volume: VolumeItem) {
    const confirmed = window.confirm(
      `Delete ${volume.title}? Chapters inside this volume will be deleted too.`,
    )

    if (!confirmed) return

    setDeletingId(volume.id)
    setError(null)

    try {
      await deleteVolume(novelId, volume.id)
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.')
    } finally {
      setDeletingId(null)
    }
  }

  if (volumes.length === 0) {
    return (
      <div className={cardClassName}>
        <p className="text-sm text-stone-500">No volumes yet. Create first volume before chapters.</p>
      </div>
    )
  }

  return (
    <div className={listClassName}>
      <ul className="divide-y divide-stone-200">
        {volumes.map((volume) => (
          <li key={volume.id} className="px-4 py-4">
            {editingId === volume.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={smallLabelClassName}>Number</label>
                    <input
                      type="number"
                      min={1}
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={smallLabelClassName}>Title</label>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className={secondaryButtonClassName}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(volume.id)}
                    disabled={saving}
                    className={primaryButtonClassName}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`${listRowClassName} px-0 py-0`}>
                <div className="min-w-0">
                  <Link
                    href={`/novels/${novelId}/volumes/${volume.id}`}
                    className="text-base font-semibold text-stone-900 hover:text-stone-700"
                  >
                    Volume {volume.number} · {volume.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">
                    {volume.chapterCount} chapter{volume.chapterCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <AddChapterForm novelId={novelId} volumeId={volume.id} />
                  <Link
                    href={`/novels/${novelId}/volumes/${volume.id}`}
                    className={ghostButtonClassName}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => startEdit(volume)}
                    className={iconButtonClassName}
                    aria-label="Edit volume"
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(volume)}
                    disabled={deletingId === volume.id}
                    className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
                    aria-label="Delete volume"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
