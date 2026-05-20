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
