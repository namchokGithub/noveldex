import Link from 'next/link'
import { Character } from '@/app/types'

interface Props {
  summary: string
  novelId: string
  characters: Character[]
}

export default function SummaryRenderer({
  summary,
  novelId,
  characters,
}: Props) {
  if (!summary) {
    return (
      <p className="text-gray-500 italic">No summary yet.</p>
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
          {part}
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
            className="font-medium text-blue-400 hover:underline"
          >
            [[{part}]]
          </Link>
        )
      } else {
        // Not found - render as gray text
        return (
          <span key={index} className="text-gray-400">
            [[{part}]]
          </span>
        )
      }
    }
  })

  return (
    <div className="text-sm leading-relaxed text-gray-300">
      {elements}
    </div>
  )
}
