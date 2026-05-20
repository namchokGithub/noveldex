export interface Novel {
  id: string
  title: string
  author: string
  status: 'reading' | 'completed' | 'dropped' | 'on_hold'
  description: string
  cover_url: string
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  novel_id: string
  number: number
  title: string
  summary: string
  read_at: string | null
  created_at: string
  updated_at: string
}

export interface ChapterSummary {
  id: string
  number: number
  title: string
  read_at: string | null
}

export interface Character {
  id: string
  novel_id: string
  name: string
  aliases: string[]
  role: string
  description: string
  first_appearance_chapter_id: string | null
  chapter_count: number
  chapters?: ChapterSummary[]
  created_at: string
  updated_at: string
}

export interface ChapterWithCharacters extends Chapter {
  characters: Character[]
}
