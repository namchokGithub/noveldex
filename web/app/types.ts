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

export interface Volume {
  id: string
  novel_id: string
  number: number
  title: string
  chapter_count: number
  read_count: number
  created_at: string
  updated_at: string
}

export interface PaginationMeta {
  page: number
  per_page: number
  total_items: number
  total_pages: number
}

export interface VolumeListSummary {
  total_volumes: number
  total_chapters: number
  read_count: number
}

export interface PaginatedVolumes {
  items: Volume[]
  pagination: PaginationMeta
  summary: VolumeListSummary
}

export interface Tag {
  id: string
  novel_id: string
  name: string
}

export interface Chapter {
  id: string
  volume_id: string
  number: number
  title: string
  summary: string
  read_at: string | null
  tags: Tag[]
  created_at: string
  updated_at: string
}

export interface ChapterSummary {
  id: string
  volume_id: string
  number: number
  title: string
  read_at: string | null
}

export interface NovelEvent {
  id: string
  novel_id: string
  chapter_id: string | null
  chapter_volume_id: string | null
  chapter_title: string | null
  chapter_number: number | null
  title: string
  description: string
  story_date: string
  sort_order: number
  character_names: string[]
  created_at: string
  updated_at: string
}

export interface CharacterRole {
  id: string
  code: string
  name: string
  is_active: boolean
}

export interface Character {
  id: string
  novel_id: string
  name: string
  aliases: string[]
  role_id: string
  role: string
  role_name: string
  profile_image_url: string | null
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

export interface SearchChapterResult {
  id: string
  volume_id: string
  number: number
  title: string
  summary_snippet: string
}

export interface SearchCharacterResult {
  id: string
  name: string
  role: string
  description_snippet: string
}

export interface SearchEventResult {
  id: string
  title: string
  description: string
  story_date: string
}

export interface CharacterListSummary {
  total_characters: number
}

export interface PaginatedCharacters {
  items: Character[]
  pagination: PaginationMeta
  summary: CharacterListSummary
}

export interface SearchResult {
  chapters: SearchChapterResult[]
  characters: SearchCharacterResult[]
  events: SearchEventResult[]
}
