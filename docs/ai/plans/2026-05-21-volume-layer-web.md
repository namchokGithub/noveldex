# Volume Layer — Web Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the web app to the new `Novel → Volume → Chapter` API — fix broken API calls, update types, and move the chapter route under volumes. Volumes remain invisible to users.

**Architecture:** Chapters in API responses carry `volume_id`. The novel page fetches volumes then chapters per volume (flattened). All chapter links and mutations thread `volumeId` through from URL params. Chapter page route moves from `chapters/[chapterId]/` to `volumes/[volumeId]/chapters/[chapterId]/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4. No test suite — verification is `pnpm lint` per task and `pnpm build` at the end.

> **IMPORTANT before writing any Next.js code:** Read the relevant guide in `apps/web/node_modules/next/dist/docs/`. Heed deprecation notices — this is Next.js 16 which has breaking changes vs training data.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/web/app/types.ts` |
| Modify | `apps/web/app/novels/[id]/ChapterListWithFilters.tsx` |
| Modify | `apps/web/app/novels/[id]/page.tsx` |
| Modify | `apps/web/app/novels/[id]/AddChapterForm.tsx` |
| Create | `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx` |
| Create | `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx` |
| Create | `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/SummaryRenderer.tsx` |
| Create | `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/LinkedCharactersPanel.tsx` |
| Delete | `apps/web/app/novels/[id]/chapters/` (entire folder) |

---

### Task 1: Update types

**Files:**
- Modify: `apps/web/app/types.ts`

- [ ] **Step 1: Rewrite the file**

```typescript
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
  created_at: string
  updated_at: string
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

export interface SearchChapterResult {
  id: string
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

export interface SearchResult {
  chapters: SearchChapterResult[]
  characters: SearchCharacterResult[]
  events: SearchEventResult[]
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/types.ts
git commit -m "feat(web/types): add Volume, replace Chapter.novel_id with volume_id"
```

---

### Task 2: Fix chapter list links

**Files:**
- Modify: `apps/web/app/novels/[id]/ChapterListWithFilters.tsx`

- [ ] **Step 1: Update chapter link href**

In `apps/web/app/novels/[id]/ChapterListWithFilters.tsx`, find the `<Link>` inside the chapter list and change:

```tsx
href={`/novels/${novelId}/chapters/${chapter.id}`}
```

To:

```tsx
href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}`}
```

The surrounding context (for locating the line):

```tsx
<li key={chapter.id}>
  <Link
    href={`/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}`}
    className={listRowClassName}>
```

- [ ] **Step 2: Verify lint passes**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/novels/[id]/ChapterListWithFilters.tsx
git commit -m "feat(web): update chapter list links to volume-nested route"
```

---

### Task 3: Update novel page + AddChapterForm

**Files:**
- Modify: `apps/web/app/novels/[id]/page.tsx`
- Modify: `apps/web/app/novels/[id]/AddChapterForm.tsx`

These two files must be updated together: the page passes `volumeId` to `AddChapterForm`, which requires the new prop.

- [ ] **Step 1: Rewrite `apps/web/app/novels/[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Volume, Chapter, Character, Tag } from '../../types'
import AddChapterForm from './AddChapterForm'
import ChapterListWithFilters from './ChapterListWithFilters'
import { T } from '@/components/i18n/I18nProvider'
import {
  backLinkClassName,
  cardClassName,
  chipClassName,
  DashboardPage,
  formatDisplayDate,
  mutedCardClassName,
  SectionHeading,
  statusColorClassNames,
} from '../ui'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getNovel(id: string): Promise<Novel | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return body.data as Novel
  } catch {
    return null
  }
}

async function getVolumes(novelId: string): Promise<Volume[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/volumes`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Volume[]) ?? []
  } catch {
    return []
  }
}

async function getChaptersByVolume(novelId: string, volumeId: string): Promise<Chapter[]> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const body = await res.json()
    return ((body.data as Chapter[]) ?? []).map((chapter) => ({
      ...chapter,
      tags: chapter.tags ?? [],
    }))
  } catch {
    return []
  }
}

async function getCharacters(id: string): Promise<Character[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/characters`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Character[]) ?? []
  } catch {
    return []
  }
}

async function getTags(id: string): Promise<Tag[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/tags`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Tag[]) ?? []
  } catch {
    return []
  }
}

export default async function NovelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, volumes, characters, tags] = await Promise.all([
    getNovel(id),
    getVolumes(id),
    getCharacters(id),
    getTags(id),
  ])

  if (!novel) notFound()

  const chapters = (
    await Promise.all(volumes.map((v) => getChaptersByVolume(id, v.id)))
  ).flat()

  const sorted = [...chapters].sort((a, b) => a.number - b.number)
  const availableTags =
    tags.length > 0
      ? tags
      : sorted
          .flatMap((chapter) => chapter.tags)
          .filter((tag, index, array) => array.findIndex((entry) => entry.id === tag.id) === index)

  const readCount = sorted.filter((chapter) => chapter.read_at).length

  return (
    <DashboardPage maxWidth="max-w-6xl">
      <div className="space-y-5">
        <Link href="/novels" className={backLinkClassName}>
          ← <T k="nav.allNovels" />
        </Link>

        <SectionHeading
          eyebrow={<T k="novel.eyebrow" />}
          title={novel.title}
          description={novel.description || <T k="novel.workspaceFallback" />}
          action={<AddChapterForm novelId={id} volumeId={volumes[0]?.id ?? ''} />}
        />

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={mutedCardClassName}>
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  <T k="common.overview" />
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColorClassNames[novel.status]}`}
                    >
                      <T k={`status.${novel.status}` as const} />
                    </span>
                    {novel.author ? (
                      <span className={chipClassName}>{novel.author}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novel.chapters" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{sorted.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200/70">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
                        <T k="novel.read" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900">{readCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  <T k="novel.explore" />
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  <Link
                    href={`/novels/${id}/characters`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      <T k="novel.characters" />
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T k="novel.trackedCast" values={{ count: characters.length }} />
                    </p>
                  </Link>
                  <Link
                    href={`/novels/${id}/timeline`}
                    className={`${cardClassName} p-4 transition hover:border-stone-300 hover:bg-white`}
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      <T k="novel.timeline" />
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      <T k="novel.timelineHelp" />
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    <T k="novel.chapters" />
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
                    <T k="novel.readingStructure" />
                  </h2>
                </div>
                <div className="text-right text-sm text-stone-500">
                  {novel.updated_at ? formatDisplayDate(novel.updated_at) : null}
                </div>
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
                <T k="novel.noChapters" />
              </div>
            ) : (
              <ChapterListWithFilters
                novelId={id}
                chapters={sorted}
                availableTags={availableTags}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardPage>
  )
}
```

- [ ] **Step 2: Rewrite `apps/web/app/novels/[id]/AddChapterForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  smallLabelClassName,
} from '../ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function AddChapterForm({
  novelId,
  volumeId,
}: {
  novelId: string
  volumeId: string
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const readAtRaw = (form.elements.namedItem('read_at') as HTMLInputElement).value
    const data = {
      number: Number((form.elements.namedItem('number') as HTMLInputElement).value),
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      summary: (form.elements.namedItem('summary') as HTMLTextAreaElement).value,
      read_at: readAtRaw || null,
    }

    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }

      form.reset()
      setOpen(false)
      router.refresh()
    } catch {
      setError(t('common.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryButtonClassName}>
        {t('addChapter.button')}
      </button>
    )
  }

  return (
    <div className={modalBackdropClassName}>
      <div className={modalPanelClassName}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            {t('addChapter.eyebrow')}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">
            {t('addChapter.title')}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={smallLabelClassName}>{t('addChapter.numberRequired')}</label>
            <input
              name="number"
              type="number"
              min={1}
              required
              className={inputClassName}
              placeholder="1"
            />
          </div>
          <div>
            <label className={smallLabelClassName}>{t('common.titleRequired')}</label>
            <input
              name="title"
              required
              className={inputClassName}
              placeholder={t('addChapter.chapterTitlePlaceholder')}
            />
          </div>
          <div>
            <label className={smallLabelClassName}>{t('addChapter.summary')}</label>
            <textarea
              name="summary"
              rows={3}
              className={inputClassName}
              placeholder={t('addChapter.summaryPlaceholder')}
            />
          </div>
          <div>
            <label className={smallLabelClassName}>{t('addChapter.dateRead')}</label>
            <input name="read_at" type="date" className={inputClassName} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className={ghostButtonClassName}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className={primaryButtonClassName}>
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify lint passes**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/novels/[id]/page.tsx apps/web/app/novels/[id]/AddChapterForm.tsx
git commit -m "feat(web): fetch chapters via volumes, pass volumeId to AddChapterForm"
```

---

### Task 4: Create new chapter route

**Files:**
- Create: `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx`
- Create: `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx`

These two files must be created together — `page.tsx` passes `volumeId` to `ChapterEditor`.

- [ ] **Step 1: Create `page.tsx` at new location**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ChapterWithCharacters } from '@/app/types'
import ChapterEditor from './ChapterEditor'
import { backLinkClassName, DashboardPage, SectionHeading } from '@/app/novels/ui'
import { T } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string
): Promise<ChapterWithCharacters | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`,
      { cache: 'no-store' }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    const data = body.data as ChapterWithCharacters
    if (!data.characters) data.characters = []
    if (!data.tags) data.tags = []
    return data
  } catch {
    return null
  }
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; volumeId: string; chapterId: string }>
}) {
  const { id, volumeId, chapterId } = await params

  const chapter = await getChapter(id, volumeId, chapterId)
  if (!chapter) notFound()

  return (
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          ← <T k="nav.backToNovel" />
        </Link>

        <SectionHeading
          eyebrow={<T k="chapter.pageEyebrow" values={{ number: chapter.number }} />}
          title={chapter.title}
          description={<T k="chapter.pageDescription" />}
        />

        <ChapterEditor chapter={chapter} novelId={id} volumeId={volumeId} />
      </div>
    </DashboardPage>
  )
}
```

- [ ] **Step 2: Create `ChapterEditor.tsx` at new location**

```tsx
'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterWithCharacters, Tag } from '@/app/types'
import {
  cardClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
  tagClassName,
} from '@/app/novels/ui'
import { useI18n } from '@/components/i18n/I18nProvider'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function ChapterEditor({
  chapter,
  novelId,
  volumeId,
}: {
  chapter: ChapterWithCharacters
  novelId: string
  volumeId: string
}) {
  const { t } = useI18n()
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [summary, setSummary] = useState(chapter.summary ?? '')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarySaving, setSummarySaving] = useState(false)

  const [readAt, setReadAt] = useState(chapter.read_at ?? '')
  const [readAtError, setReadAtError] = useState<string | null>(null)
  const [readAtSaving, setReadAtSaving] = useState(false)

  const [suggestion, setSuggestion] = useState<{ names: string[]; anchorText: string } | null>(null)
  const [tags, setTags] = useState<Tag[]>(chapter.tags ?? [])
  const [allTags, setAllTags] = useState<Tag[]>(chapter.tags ?? [])
  const [tagQuery, setTagQuery] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [tagLoading, setTagLoading] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [tagSaving, setTagSaving] = useState(false)

  const filteredTagOptions = useMemo(() => {
    const linked = new Set(tags.map((tag) => tag.id))
    return allTags.filter((tag) => {
      if (linked.has(tag.id)) return false
      if (!tagQuery.trim()) return true
      return tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase())
    })
  }, [allTags, tagQuery, tags])

  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setSuggestion(null)
      return
    }
    const ta = e.currentTarget
    const before = ta.value.slice(0, ta.selectionStart ?? ta.value.length)
    const match = before.match(/\[\[([^\]]*)$/)
    if (!match) {
      setSuggestion(null)
      return
    }
    const typed = match[1]
    const names = chapter.characters
      .map((c) => c.name)
      .filter((n) => n.toLowerCase().startsWith(typed.toLowerCase()))
    setSuggestion({ names, anchorText: match[0] })
  }

  function insertSuggestion(name: string) {
    if (!suggestion) return
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? summary.length
    const before = summary.slice(0, pos)
    const after = summary.slice(pos)
    const replaced =
      before.slice(0, before.length - suggestion.anchorText.length) + `[[${name}]]`
    setSummary(replaced + after)
    setSuggestion(null)
  }

  async function ensureTagListLoaded() {
    if (allTags.length > 0 || tagLoading) return
    setTagLoading(true)
    setTagError(null)
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/tags`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTagError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      const body = await res.json()
      setAllTags((body.data as Tag[]) ?? [])
    } catch {
      setTagError(t('common.networkError'))
    } finally {
      setTagLoading(false)
    }
  }

  async function createOrFindTag(name: string): Promise<Tag | null> {
    const normalized = name.trim()
    if (!normalized) return null

    const existing = allTags.find(
      (tag) => tag.name.toLowerCase() === normalized.toLowerCase()
    )
    if (existing) return existing

    const res = await fetch(`${BASE}/api/v1/novels/${novelId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: normalized }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    const body = await res.json()
    const created = body.data as Tag
    setAllTags((current) => {
      if (current.some((tag) => tag.id === created.id)) return current
      return [...current, created].sort((a, b) => a.name.localeCompare(b.name))
    })
    return created
  }

  async function linkTag(tag: Tag) {
    if (tags.some((entry) => entry.id === tag.id)) return
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }
    setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleAddTag(name?: string) {
    const nextName = (name ?? tagQuery).trim()
    if (!nextName) return
    setTagSaving(true)
    setTagError(null)
    try {
      const tag = await createOrFindTag(nextName)
      if (!tag) return
      await linkTag(tag)
      setTagQuery('')
      setTagPickerOpen(false)
    } catch (error) {
      setTagError(error instanceof Error ? error.message : t('chapter.failedAddTag'))
    } finally {
      setTagSaving(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    setTagSaving(true)
    setTagError(null)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags/${tagId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTagError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setTags((current) => current.filter((tag) => tag.id !== tagId))
    } catch {
      setTagError(t('common.networkError'))
    } finally {
      setTagSaving(false)
    }
  }

  async function saveSummary() {
    setSummaryError(null)
    setSummarySaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSummaryError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      router.refresh()
    } catch {
      setSummaryError(t('common.networkError'))
    } finally {
      setSummarySaving(false)
    }
  }

  async function saveReadAt() {
    setReadAtError(null)
    setReadAtSaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read_at: readAt }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setReadAtError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      router.refresh()
    } catch {
      setReadAtError(t('common.networkError'))
    } finally {
      setReadAtSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={cardClassName}>
        <label className={smallLabelClassName}>{t('addChapter.summary')}</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyUp={handleKeyUp}
            rows={6}
            className={`${inputClassName} min-h-[180px]`}
            placeholder={t('addChapter.summaryPlaceholder')}
          />
          {suggestion && suggestion.names.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              {suggestion.names.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertSuggestion(name)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {summaryError && <p className="mt-2 text-sm text-rose-600">{summaryError}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveSummary}
            disabled={summarySaving}
            className={primaryButtonClassName}
          >
            {summarySaving ? t('common.saving') : t('chapter.saveSummary')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={cardClassName}>
          <label className={smallLabelClassName}>{t('addChapter.dateRead')}</label>
          <input
            type="date"
            value={readAt}
            onChange={(e) => setReadAt(e.target.value)}
            className={inputClassName}
          />
          {readAtError && <p className="mt-2 text-sm text-rose-600">{readAtError}</p>}
          <div className="mt-3 flex justify-end">
            <button
              onClick={saveReadAt}
              disabled={readAtSaving}
              className={primaryButtonClassName}
            >
              {readAtSaving ? t('common.saving') : t('chapter.saveDate')}
            </button>
          </div>
        </div>

        <div className={cardClassName}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
            {t('chapter.characters')}
          </h2>
          {chapter.characters.length === 0 ? (
            <p className="text-sm text-stone-500">{t('chapter.noLinkedCharacters')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {chapter.characters.map((char) => (
                <li key={char.id}>
                  <a
                    href={`/novels/${novelId}/characters/${char.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200/70"
                  >
                    {char.name}
                    <span className="text-xs text-stone-500">{char.role}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClassName}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
          {t('chapter.tags')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className={tagClassName}>
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={tagSaving}
                className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
                aria-label={t('chapter.removeTag', { name: tag.name })}
              >
                ×
              </button>
            </span>
          ))}

          {!tagPickerOpen ? (
            <button
              type="button"
              onClick={async () => {
                setTagPickerOpen(true)
                await ensureTagListLoaded()
              }}
              className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900"
            >
              {t('chapter.addTag')}
            </button>
          ) : (
            <div className="w-full max-w-sm rounded-[22px] border border-stone-200 bg-stone-50/90 p-3 shadow-sm">
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddTag()
                  }
                  if (e.key === 'Escape') {
                    setTagPickerOpen(false)
                    setTagQuery('')
                  }
                }}
                placeholder={t('chapter.addTagPlaceholder')}
                className={inputClassName}
              />
              <div className="mt-2 max-h-40 overflow-y-auto">
                {tagLoading && (
                  <p className="text-xs text-stone-500">{t('chapter.loadingTags')}</p>
                )}
                {!tagLoading && filteredTagOptions.length > 0 && (
                  <ul className="space-y-1">
                    {filteredTagOptions.map((tag) => (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => void handleAddTag(tag.name)}
                          className="w-full rounded-xl px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-white"
                        >
                          {tag.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!tagLoading && filteredTagOptions.length === 0 && (
                  <p className="text-xs text-stone-500">
                    {tagQuery.trim() ? t('chapter.createTagHint') : t('chapter.noMoreTags')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTagPickerOpen(false)
                    setTagQuery('')
                  }}
                  className={secondaryButtonClassName}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  disabled={tagSaving || !tagQuery.trim()}
                  className={primaryButtonClassName}
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          )}
        </div>
        {tagError && <p className="mt-2 text-sm text-rose-600">{tagError}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify lint passes**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/novels/[id]/volumes/"
git commit -m "feat(web): add volumes/[volumeId]/chapters/[chapterId] route"
```

---

### Task 5: Move helper components and delete old folder

**Files:**
- Create: `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/SummaryRenderer.tsx`
- Create: `apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/LinkedCharactersPanel.tsx`
- Delete: `apps/web/app/novels/[id]/chapters/` (entire folder)

- [ ] **Step 1: Write `SummaryRenderer.tsx` at new location**

Only change from the original: `'../../../../types'` → `'@/app/types'`

```tsx
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

  const characterMap = new Map<string, string>()
  characters.forEach((char) => {
    characterMap.set(char.name, char.id)
  })

  const parts = summary.split(/\[\[([^\]]+)\]\]/)

  const elements = parts.map((part, index) => {
    if (index % 2 === 0) {
      return (
        <span key={index}>
          {part}
        </span>
      )
    } else {
      const charId = characterMap.get(part)
      if (charId) {
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
```

- [ ] **Step 2: Write `LinkedCharactersPanel.tsx` at new location**

Only change from the original: `'../../../../types'` → `'@/app/types'`

```tsx
import Link from 'next/link';
import { Character } from '@/app/types';
import { T } from '@/components/i18n/I18nProvider';

interface Props {
  characters: Character[];
  novelId: string;
}

export default function LinkedCharactersPanel({ characters, novelId }: Props) {
  if (characters.length === 0) {
    return <p className="text-sm text-gray-500"><T k="chapter.noLinkedCharacters" /></p>;
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        <T k="chapter.characters" />
      </h2>
      <ul className="flex flex-wrap gap-2">
        {characters.map((char) => (
          <li key={char.id}>
            <Link
              href={`/novels/${novelId}/characters/${char.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-200 hover:bg-gray-700"
            >
              {char.name}
              <span className="text-xs text-gray-500">{char.role}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Delete old chapter folder**

```bash
rm -rf "apps/web/app/novels/[id]/chapters"
```

- [ ] **Step 4: Verify lint passes**

```bash
cd apps/web && pnpm lint
```

Expected: no errors. (The old import paths `../../../../types` are gone; `@/app/types` is used instead.)

- [ ] **Step 5: Full build check**

```bash
cd apps/web && pnpm build
```

Expected: successful build, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/SummaryRenderer.tsx"
git add "apps/web/app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/LinkedCharactersPanel.tsx"
git add -u "apps/web/app/novels/[id]/chapters/"
git commit -m "feat(web): move chapter helper components to volume-nested route, delete old chapter route"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| Add `Volume` type | Task 1 |
| `Chapter.novel_id` → `volume_id` | Task 1 |
| Novel page: fetch volumes + chapters per volume | Task 3 |
| Novel page: pass first volumeId to AddChapterForm | Task 3 |
| AddChapterForm: POST to volume-nested endpoint | Task 3 |
| ChapterListWithFilters: link uses `chapter.volume_id` | Task 2 |
| Route: `volumes/[volumeId]/chapters/[chapterId]/` | Task 4 |
| ChapterEditor: volumeId prop, 4 URL updates | Task 4 |
| SummaryRenderer + LinkedCharactersPanel moved | Task 5 |
| Old `chapters/` folder deleted | Task 5 |
| Tags list fetch unchanged (novel-scoped) | Task 4 (ensureTagListLoaded uses `/novels/${novelId}/tags`) |

### Type consistency

- `Volume` defined Task 1, imported in Task 3 (`getVolumes` return type) ✓
- `Chapter.volume_id` defined Task 1, used in Task 2 (`chapter.volume_id` in href) ✓
- `ChapterEditor` prop `volumeId: string` defined in Task 4, passed from page.tsx in Task 4 ✓
- `AddChapterForm` prop `volumeId: string` defined in Task 3, passed from novel page in Task 3 ✓
