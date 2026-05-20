'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface NovelEvent {
  id: string
  novel_id: string
  chapter_id: string | null
  chapter_title: string
  chapter_number: number | null
  title: string
  description: string
  story_date: string
  sort_order: number
  character_names: string[]
}

interface ChapterOption {
  id: string
  number: number
  title: string
}

interface CharacterOption {
  id: string
  name: string
}

interface FormState {
  title: string
  story_date: string
  sort_order: string
  description: string
  chapter_id: string
}

const EMPTY_FORM: FormState = {
  title: '',
  story_date: '',
  sort_order: '0',
  description: '',
  chapter_id: '',
}

export default function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: novelId } = use(params)

  const [events, setEvents] = useState<NovelEvent[]>([])
  const [chapters, setChapters] = useState<ChapterOption[]>([])
  const [characters, setCharacters] = useState<CharacterOption[]>([])
  const [loading, setLoading] = useState(true)

  const [filterChars, setFilterChars] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadEvents() {
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/events`)
      if (!res.ok) return
      const body = await res.json()
      setEvents((body.data as NovelEvent[]) ?? [])
    } catch {}
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [evRes, chRes, charRes] = await Promise.all([
          fetch(`${BASE}/api/v1/novels/${novelId}/events`),
          fetch(`${BASE}/api/v1/novels/${novelId}/chapters`),
          fetch(`${BASE}/api/v1/novels/${novelId}/characters`),
        ])
        if (evRes.ok) {
          const body = await evRes.json()
          setEvents((body.data as NovelEvent[]) ?? [])
        }
        if (chRes.ok) {
          const body = await chRes.json()
          setChapters((body.data as ChapterOption[]) ?? [])
        }
        if (charRes.ok) {
          const body = await charRes.json()
          setCharacters((body.data as CharacterOption[]) ?? [])
        }
      } catch {}
      setLoading(false)
    }
    init()
  }, [novelId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayed =
    filterChars.length === 0
      ? events
      : events.filter((e) => filterChars.some((n) => e.character_names.includes(n)))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddSaving(true)
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addForm.title,
          story_date: addForm.story_date,
          sort_order: parseInt(addForm.sort_order, 10),
          description: addForm.description,
          chapter_id: addForm.chapter_id || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setAddError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setAddForm(EMPTY_FORM)
      setShowAddForm(false)
      await loadEvents()
    } catch {
      setAddError('Network error. Please try again.')
    } finally {
      setAddSaving(false)
    }
  }

  function startEdit(ev: NovelEvent) {
    setEditingId(ev.id)
    setEditForm({
      title: ev.title,
      story_date: ev.story_date,
      sort_order: String(ev.sort_order),
      description: ev.description,
      chapter_id: ev.chapter_id ?? '',
    })
    setEditError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditError(null)
    setEditSaving(true)
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/events/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          story_date: editForm.story_date,
          sort_order: parseInt(editForm.sort_order, 10),
          description: editForm.description,
          chapter_id: editForm.chapter_id || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setEditError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setEditingId(null)
      await loadEvents()
    } catch {
      setEditError('Network error. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(eventId: string) {
    if (!confirm('Delete this event?')) return
    setDeletingId(eventId)
    try {
      await fetch(`${BASE}/api/v1/novels/${novelId}/events/${eventId}`, { method: 'DELETE' })
      await loadEvents()
    } catch {}
    setDeletingId(null)
  }

  function toggleFilterChar(name: string) {
    setFilterChars((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/novels/${novelId}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← Back to novel
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            {showAddForm ? 'Cancel' : '+ Add event'}
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4"
          >
            <h2 className="mb-4 text-sm font-semibold text-gray-300">New Event</h2>
            <EventFormFields form={addForm} onChange={setAddForm} chapters={chapters} />
            {addError && <p className="mt-2 text-sm text-red-400">{addError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setAddForm(EMPTY_FORM)
                }}
                className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {addSaving ? 'Saving…' : 'Add event'}
              </button>
            </div>
          </form>
        )}

        {characters.length > 0 && (
          <div ref={filterRef} className="relative mb-6">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500"
            >
              Filter by character
              {filterChars.length > 0 && (
                <span className="rounded-full bg-blue-700 px-1.5 py-0.5 text-xs text-white">
                  {filterChars.length}
                </span>
              )}
              <span className="text-gray-500 text-xs">{filterOpen ? '▲' : '▼'}</span>
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-48 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-lg">
                {characters.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={filterChars.includes(c.name)}
                      onChange={() => toggleFilterChar(c.name)}
                      className="accent-blue-500"
                    />
                    {c.name}
                  </label>
                ))}
                {filterChars.length > 0 && (
                  <button
                    onClick={() => setFilterChars([])}
                    className="w-full border-t border-gray-800 px-3 py-1.5 text-left text-xs text-gray-500 hover:text-gray-300"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-600">Loading…</p>
        ) : displayed.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No events yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[5px] top-0 h-full w-px bg-gray-800" />
            <ul className="flex flex-col gap-8">
              {displayed.map((ev) => (
                <li id={`event-${ev.id}`} key={ev.id} className="relative pl-8">
                  <p className="mb-1 text-[11px] text-gray-500">{ev.story_date}</p>
                  <span className="absolute left-0 top-6 h-[11px] w-[11px] rounded-full border-2 border-blue-500 bg-gray-950" />

                  {editingId === ev.id ? (
                    <form
                      onSubmit={handleEdit}
                      className="rounded-xl border border-blue-800 bg-gray-900 p-4"
                    >
                      <EventFormFields
                        form={editForm}
                        onChange={setEditForm}
                        chapters={chapters}
                      />
                      {editError && <p className="mt-2 text-sm text-red-400">{editError}</p>}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="group rounded-xl border border-gray-800 bg-gray-900 p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-[15px] font-medium leading-snug text-white">
                          {ev.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEdit(ev)}
                            className="rounded p-1 text-sm text-gray-500 hover:text-gray-300"
                            aria-label="Edit"
                          >
                            ✏
                          </button>
                          <button
                            onClick={() => handleDelete(ev.id)}
                            disabled={deletingId === ev.id}
                            className="rounded p-1 text-lg leading-none text-gray-500 hover:text-red-400 disabled:opacity-50"
                            aria-label="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {ev.description && (
                        <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-gray-400">
                          {ev.description}
                        </p>
                      )}

                      {ev.chapter_id && (
                        <div className="mb-3">
                          <Link
                            href={`/novels/${novelId}/chapters/${ev.chapter_id}`}
                            className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
                          >
                            Ch.{String(ev.chapter_number ?? '').padStart(2, '0')} ·{' '}
                            {ev.chapter_title}
                          </Link>
                        </div>
                      )}

                      {ev.character_names.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ev.character_names.map((name) => {
                            const char = characters.find((c) => c.name === name)
                            return char ? (
                              <Link
                                key={name}
                                href={`/novels/${novelId}/characters/${char.id}`}
                                className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
                              >
                                {name}
                              </Link>
                            ) : (
                              <span
                                key={name}
                                className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400"
                              >
                                {name}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}

function EventFormFields({
  form,
  onChange,
  chapters,
}: {
  form: FormState
  onChange: (f: FormState) => void
  chapters: ChapterOption[]
}) {
  function set(key: keyof FormState) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onChange({ ...form, [key]: e.target.value })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Title *</label>
        <input
          value={form.title}
          onChange={set('title')}
          required
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          placeholder="Event title"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Story date *</label>
          <input
            value={form.story_date}
            onChange={set('story_date')}
            required
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Year 1349"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Sort order *</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={set('sort_order')}
            required
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={2}
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          placeholder="Optional description"
        />
      </div>
      {chapters.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Chapter</label>
          <select
            value={form.chapter_id}
            onChange={set('chapter_id')}
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">— none —</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                Ch.{ch.number} · {ch.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
