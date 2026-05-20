'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import type { Chapter, Tag } from '@/app/types'

export default function ChapterListWithFilters({
  novelId,
  chapters,
  availableTags,
}: {
  novelId: string
  chapters: Chapter[]
  availableTags: Tag[]
}) {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])

  const remainingTags = useMemo(
    () => availableTags.filter((tag) => !selectedTags.some((selected) => selected.id === tag.id)),
    [availableTags, selectedTags],
  )

  const filteredChapters = useMemo(() => {
    if (selectedTags.length === 0) return chapters
    return chapters.filter((chapter) =>
      selectedTags.every((tag) => chapter.tags.some((chapterTag) => chapterTag.id === tag.id)),
    )
  }, [chapters, selectedTags])

  function addTag(tagId: string) {
    const tag = remainingTags.find((entry) => entry.id === tagId)
    if (!tag) return
    setSelectedTags((current) => [...current, tag])
  }

  function removeTag(tagId: string) {
    setSelectedTags((current) => current.filter((tag) => tag.id !== tagId))
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Tags:</span>
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => removeTag(tag.id)}
              className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-800"
            >
              {tag.name}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <select
            value=""
            onChange={(event) => addTag(event.target.value)}
            disabled={remainingTags.length === 0}
            className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1 text-xs text-gray-300 outline-none disabled:cursor-not-allowed disabled:text-gray-600"
          >
            <option value="">+ Add tag filter</option>
            {remainingTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredChapters.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-600">No chapters match the selected tags.</p>
      ) : (
        <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
          {filteredChapters.map((chapter) => (
            <li key={chapter.id}>
              <Link
                href={`/novels/${novelId}/chapters/${chapter.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-900"
              >
                <div className="min-w-0">
                  <span className="text-sm text-white">
                    Ch. {chapter.number} — {chapter.title}
                  </span>
                  {chapter.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chapter.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-800"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {chapter.read_at && (
                  <span className="shrink-0 text-xs text-gray-500">{chapter.read_at}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
