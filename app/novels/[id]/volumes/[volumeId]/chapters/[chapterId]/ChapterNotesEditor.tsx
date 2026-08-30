'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterNote, Character } from '@/app/types'
import { CHAPTER_SEARCH_SOURCE_EVENT, type ChapterSearchSource } from '@/components/commands/CommandPalette'
import { useI18n } from '@/components/i18n/I18nProvider'
import { cardClassName, inputClassName, primaryButtonClassName, secondaryButtonClassName, smallLabelClassName } from '@/app/novels/ui'
import { updateChapter } from '@/libs/api'

function nextId() { return crypto.randomUUID() }

export default function ChapterNotesEditor({ notes: initialNotes, characters, novelId, volumeId, chapterId, initialFind = '' }: { notes: ChapterNote[]; characters: Character[]; novelId: string; volumeId: string; chapterId: string; initialFind?: string }) {
  const { t } = useI18n(); const router = useRouter()
  const [notes, setNotes] = useState<ChapterNote[]>(initialNotes), [editingId, setEditingId] = useState<string | null>(null), [draft, setDraft] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const focusMatch = useCallback((field: 'title' | 'summary', start: number, length: number) => {
    if (field === 'title') return
    let offset = start
    for (const note of notes) {
      if (offset <= note.content.length) {
        setEditingId(note.id)
        setDraft(note.content)
        window.requestAnimationFrame(() => {
          const input = refs.current.get(note.id)
          input?.focus()
          input?.setSelectionRange(offset, offset + length)
          input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        return
      }
      offset -= note.content.length + 1
    }
  }, [notes])
  const source = useCallback((): ChapterSearchSource => ({ title: '', summary: notes.map((note) => note.content).join('\n'), focusMatch }), [focusMatch, notes])
  useEffect(() => { const handler = (event: Event) => { const reply = (event as CustomEvent<(next: ChapterSearchSource) => void>).detail; if (typeof reply === 'function') reply(source()) }; window.addEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler); return () => window.removeEventListener(CHAPTER_SEARCH_SOURCE_EVENT, handler) }, [source])
  useEffect(() => { const query = initialFind.trim(); if (!query) return; const joined = notes.map((note) => note.content).join('\n').toLocaleLowerCase(); const start = joined.indexOf(query.toLocaleLowerCase()); if (start < 0) return; const frame = window.requestAnimationFrame(() => focusMatch('summary', start, query.length)); return () => window.cancelAnimationFrame(frame) }, [focusMatch, initialFind, notes])
  function begin(note?: ChapterNote) { setEditingId(note?.id ?? '__new__'); setDraft(note?.content ?? ''); setError(null) }
  async function save() { if (!editingId) return; const content = draft.trim(); if (!content) { setError(t('chapter.noteRequired')); return } const now = new Date().toISOString(); const note = editingId === '__new__' ? { id: nextId(), content, created_at: now, updated_at: now } : notes.find((item) => item.id === editingId); if (!note) return; const next = editingId === '__new__' ? [...notes, note] : notes.map((item) => item.id === note.id ? { ...item, content, updated_at: now } : item); setSaving(true); setError(null); try { await updateChapter(novelId, volumeId, chapterId, { notes: next }); setNotes(next); setEditingId(null); setDraft(''); router.refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : t('common.networkError')) } finally { setSaving(false) } }
  async function remove(note: ChapterNote) { if (!window.confirm(t('chapter.deleteNoteConfirm'))) return; const next = notes.filter((item) => item.id !== note.id); setSaving(true); try { await updateChapter(novelId, volumeId, chapterId, { notes: next }); setNotes(next); router.refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : t('common.networkError')) } finally { setSaving(false) } }
  function mentionSuggestions(value: string, cursor: number) { const match = value.slice(0, cursor).match(/\[\[([^\]]*)$/); if (!match) return []; return characters.filter((character) => character.name.toLocaleLowerCase().startsWith(match[1].toLocaleLowerCase())).map((character) => character.name) }
  return <section className={cardClassName}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">{t('chapter.notes')}</h2>{editingId === null && <button type="button" onClick={() => begin()} className={secondaryButtonClassName}>{t('chapter.addNote')}</button>}</div><div className="space-y-3">{notes.map((note, index) => <article key={note.id} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"><div className="mb-2 flex items-center justify-between gap-2 text-xs text-stone-500"><span>{t('chapter.noteNumber', { number: index + 1 })}</span><time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleString()}</time></div>{editingId === note.id ? <NoteForm value={draft} onChange={setDraft} inputRef={(node) => { if (node) refs.current.set(note.id, node) }} suggestionsFor={mentionSuggestions} onSave={() => void save()} onCancel={() => setEditingId(null)} saving={saving} /> : <><p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{note.content}</p><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => begin(note)} className={secondaryButtonClassName}>{t('common.edit')}</button><button type="button" onClick={() => void remove(note)} disabled={saving} className={secondaryButtonClassName}>{t('common.delete')}</button></div></>}</article>)}{editingId === '__new__' && <article className="rounded-2xl border border-dashed border-stone-300 p-4"><NoteForm value={draft} onChange={setDraft} inputRef={(node) => { if (node) refs.current.set('__new__', node) }} suggestionsFor={mentionSuggestions} onSave={() => void save()} onCancel={() => setEditingId(null)} saving={saving} /></article>}{notes.length === 0 && editingId === null && <p className="py-5 text-center text-sm text-stone-500">{t('chapter.noNotes')}</p>}</div>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</section>
}

function NoteForm({ value, onChange, inputRef, suggestionsFor, onSave, onCancel, saving }: { value: string; onChange: (value: string) => void; inputRef: (node: HTMLTextAreaElement | null) => void; suggestionsFor: (value: string, cursor: number) => string[]; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const { t } = useI18n(); const [suggestions, setSuggestions] = useState<string[]>([])
  function update(event: React.ChangeEvent<HTMLTextAreaElement>) { onChange(event.target.value); setSuggestions(suggestionsFor(event.target.value, event.target.selectionStart ?? event.target.value.length)) }
  return <div className="relative"><label className={smallLabelClassName}>{t('chapter.noteContent')}</label><textarea ref={inputRef} value={value} onChange={update} onKeyUp={(event) => setSuggestions(suggestionsFor(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length))} rows={4} className={`${inputClassName} min-h-32`} placeholder={t('chapter.notePlaceholder')} />{suggestions.length > 0 && <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">{suggestions.map((name) => <button key={name} type="button" onMouseDown={(event) => { event.preventDefault(); const next = value.replace(/\[\[[^\]]*$/, `[[${name}]]`); onChange(next); setSuggestions([]) }} className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">{name}</button>)}</div>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className={secondaryButtonClassName}>{t('common.cancel')}</button><button type="button" onClick={onSave} disabled={saving} className={primaryButtonClassName}>{saving ? t('common.saving') : t('common.save')}</button></div></div>
}
