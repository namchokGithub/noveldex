import Link from 'next/link'
import { Character } from '@/app/types'

interface Props {
  summary: string
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
  novelId,
  characters,
  highlightQuery = '',
}: Props) {
  if (!summary) {
    return (
      <p className="text-sm italic text-stone-400">No summary yet.</p>
    )
  }

  // Build a map of character name -> id for quick lookup
  const characterMap = new Map<string, string>()
  characters.forEach((char) => {
    characterMap.set(char.name, char.id)
  })

  // Split on [[Name]] pattern
  const parts = summary.split(/\[\[([^\]]+)\]\]/)

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
            [[{part}]]
          </Link>
        )
      } else {
        // Not found - render as gray text
        return (
          <span key={index} className="text-stone-400">
            [[{part}]]
          </span>
        )
      }
    }
  })

  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-stone-600">
      {elements}
    </div>
  )
}
