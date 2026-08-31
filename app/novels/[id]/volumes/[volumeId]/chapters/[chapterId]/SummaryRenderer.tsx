"use client";

import Link from 'next/link'

import { useState } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Character, ChapterNote } from '@/app/types'

interface Props {
  summary: string
  notes?: ChapterNote[]
  novelId: string
  characters: Character[]
  highlightQuery?: string
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return <>{parts.map((part, index) => part.toLocaleLowerCase() === query.toLocaleLowerCase() ? <mark key={index} className="rounded bg-amber-200 px-0.5 text-stone-900">{part}</mark> : <span key={index}>{part}</span>)}</>
}

export default function SummaryRenderer({
  summary,
  notes = [],
  novelId,
  characters,
  highlightQuery = '',
}: Props) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const renderedNotes = notes.length > 0 ? notes : summary ? [{ id: 'legacy-summary', content: summary, created_at: '', updated_at: '' }] : []
  if (renderedNotes.length === 0) {
    return (
      <p className="text-sm italic text-stone-400">No summary yet.</p>
    )
  }

  // Build a map of character name -> id for quick lookup
  const characterMap = new Map<string, string>()
  characters.forEach((char) => {
    characterMap.set(char.name, char.id)
  })

  function renderNote(note: ChapterNote) {
  const parts = note.content.split(/\[\[([^\]]+)\]\]/)

  // Split returns: [text_before, match1, text_after, match2, ...]
  // Even indices = text, odd indices = capture group
  const elements = parts.map((part, index) => {
    if (index % 2 === 0) {
      // Regular text segment
      return (
        <span key={index}>
          <HighlightText text={part} query={highlightQuery} />
        </span>
      )
    } else {
      // This is a captured [[Name]] without the brackets
      const charId = characterMap.get(part)
      if (charId) {
        // Found in character map - render as link
        return (
          <Link
            key={index}
            href={`/novels/${novelId}/characters/${charId}`}
            className="font-medium text-sky-700 underline decoration-sky-200 underline-offset-4 hover:text-sky-900"
          >
            {part}
          </Link>
        )
      } else {
        // Not found - render as gray text
        return (
          <span key={index} className="text-stone-400">
            {part}
          </span>
        )
      }
    }
  })

  return <div className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{elements}</div>
  }

  const latestNote = renderedNotes[renderedNotes.length - 1]
  const isLongPreview = latestNote.content.length > 600

  return <div className="space-y-3"><div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Note {renderedNotes.length}</p><div className={isLongPreview && !expanded ? "max-h-64 overflow-hidden" : ""}>{renderNote(latestNote)}</div>{isLongPreview ? <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-3 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-500">{expanded ? t("common.showLess") : t("common.readFull")}</button> : null}</div></div>
}
