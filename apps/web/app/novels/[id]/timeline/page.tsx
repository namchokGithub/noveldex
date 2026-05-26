'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  backLinkClassName,
  cardClassName,
  DashboardPage,
  iconButtonClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  SectionHeading,
  smallLabelClassName,
  tagClassName,
  timelineDotClassName,
  timelineRailClassName,
} from '../../ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface NovelEvent {
  id: string
  novel_id: string
  chapter_id: string | null
  chapter_volume_id?: string | null
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
  volume_id: string
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
  const { t } = useI18n()
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
      setAddError(t('common.networkError'))
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
      setEditError(t('common.networkError'))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(eventId: string) {
    if (!confirm(t('timeline.deleteConfirm'))) return
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
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link
          href={`/novels/${novelId}`}
          className={backLinkClassName}
        >
          ← {t('nav.backToNovel')}
        </Link>

        <SectionHeading
          eyebrow={t('timeline.eyebrow')}
          title={t('timeline.title')}
          description={t('timeline.description')}
          action={
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className={showAddForm ? secondaryButtonClassName : primaryButtonClassName}
            >
              {showAddForm ? t('common.cancel') : t('timeline.addEventToggle')}
            </button>
          }
        />

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className={cardClassName}
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
              {t('timeline.newEvent')}
            </h2>
            <EventFormFields form={addForm} onChange={setAddForm} chapters={chapters} />
            {addError && <p className="mt-2 text-sm text-rose-600">{addError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setAddForm(EMPTY_FORM)
                }}
                className={secondaryButtonClassName}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className={primaryButtonClassName}
              >
                {addSaving ? t('common.saving') : t('timeline.addEvent')}
              </button>
            </div>
          </form>
        )}

        {characters.length > 0 && (
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={secondaryButtonClassName}
            >
              {t('timeline.filterByCharacter')}
              {filterChars.length > 0 && (
                <span className="rounded-full bg-stone-900 px-2 py-0.5 text-xs text-stone-50">
                  {filterChars.length}
                </span>
              )}
              <span className="text-stone-400 text-xs">{filterOpen ? '▲' : '▼'}</span>
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-10 mt-2 min-w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg">
                {characters.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={filterChars.includes(c.name)}
                      onChange={() => toggleFilterChar(c.name)}
                      className="accent-stone-900"
                    />
                    {c.name}
                  </label>
                ))}
                {filterChars.length > 0 && (
                  <button
                    onClick={() => setFilterChars([])}
                    className="w-full border-t border-stone-200 px-3 py-2 text-left text-xs text-stone-500 hover:text-stone-900"
                  >
                    {t('timeline.clearFilter')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
            {t('common.loading')}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
            {t('timeline.noEvents')}
          </div>
        ) : (
          <div className="relative">
            <div className={timelineRailClassName} />
            <ul className="flex flex-col gap-8">
              {displayed.map((ev) => (
                <li id={`event-${ev.id}`} key={ev.id} className="relative pl-8">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {ev.story_date}
                  </p>
                  <span className={timelineDotClassName} />

                  {editingId === ev.id ? (
                    <form
                      onSubmit={handleEdit}
                      className={cardClassName}
                    >
                      <EventFormFields
                        form={editForm}
                        onChange={setEditForm}
                        chapters={chapters}
                      />
                      {editError && <p className="mt-2 text-sm text-rose-600">{editError}</p>}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={secondaryButtonClassName}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className={primaryButtonClassName}
                        >
                          {editSaving ? t('common.saving') : t('common.save')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className={`${cardClassName} group`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-[15px] font-semibold leading-snug text-stone-900">
                          {ev.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEdit(ev)}
                            className={iconButtonClassName}
                            aria-label={t('common.edit')}
                          >
                            ✏
                          </button>
                          <button
                            onClick={() => handleDelete(ev.id)}
                            disabled={deletingId === ev.id}
                            className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
                            aria-label={t('common.delete')}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {ev.description && (
                        <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-stone-600">
                          {ev.description}
                        </p>
                      )}

                      {ev.chapter_id && (
                        <div className="mb-3">
                          {ev.chapter_volume_id ? (
                            <Link
                              href={`/novels/${novelId}/volumes/${ev.chapter_volume_id}/chapters/${ev.chapter_id}`}
                              className={tagClassName}
                            >
                              Ch.{String(ev.chapter_number ?? '').padStart(2, '0')} ·{' '}
                              {ev.chapter_title}
                            </Link>
                          ) : (
                            // Keep the label visible even if older event data is missing volume metadata.
                            <span className={tagClassName}>
                              Ch.{String(ev.chapter_number ?? '').padStart(2, '0')} ·{' '}
                              {ev.chapter_title}
                            </span>
                          )}
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
                                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200/70"
                              >
                                {name}
                              </Link>
                            ) : (
                              <span
                                key={name}
                                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500 ring-1 ring-inset ring-stone-200"
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
    </DashboardPage>
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
  const { t } = useI18n()

  function set(key: keyof FormState) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onChange({ ...form, [key]: e.target.value })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={smallLabelClassName}>{t('common.titleRequired')}</label>
        <input
          value={form.title}
          onChange={set('title')}
          required
          className={inputClassName}
          placeholder={t('timeline.field.eventTitlePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={smallLabelClassName}>{t('timeline.field.storyDate')}</label>
          <input
            value={form.story_date}
            onChange={set('story_date')}
            required
            className={inputClassName}
            placeholder={t('timeline.field.storyDatePlaceholder')}
          />
        </div>
        <div>
          <label className={smallLabelClassName}>{t('timeline.field.sortOrder')}</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={set('sort_order')}
            required
            className={inputClassName}
          />
        </div>
      </div>
      <div>
        <label className={smallLabelClassName}>{t('common.description')}</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={2}
          className={inputClassName}
          placeholder={t('timeline.field.optionalDescription')}
        />
      </div>
      {chapters.length > 0 && (
        <div>
          <label className={smallLabelClassName}>{t('timeline.field.chapter')}</label>
          <select
            value={form.chapter_id}
            onChange={set('chapter_id')}
            className={inputClassName}
          >
            <option value="">{t('timeline.field.noneOption')}</option>
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
