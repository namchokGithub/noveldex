# Volume Layer — Web Update Design

**Date:** 2026-05-21
**Status:** Approved
**Scope:** `apps/web` only — minimal wiring, volumes invisible to user

---

## Problem

The API was refactored from `Novel → Chapter` to `Novel → Volume → Chapter`. All chapter endpoints now require a `volumeId` in the path. The frontend is broken: flat chapter routes no longer exist, `types.ts` still references `novel_id` on `Chapter`, and the chapter page lives at the wrong route.

---

## Approach: Chapters carry their own `volume_id`

Chapters in API responses include `volume_id`. The frontend uses this field directly for links and passes the first volume's ID for creation. Volumes are completely invisible to users — the UI looks unchanged.

**Out of scope (future):** Volume management UI — list volumes, create/rename/delete volumes, group chapters by volume on the novel page. Add to backlog when multi-volume novels are needed.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Volume visibility | Hidden | Only "Volume 1" exists post-migration; no UI value yet |
| Chapter fetch strategy | Fetch volumes → fetch chapters per volume → flatten | Chapters endpoint requires volumeId; flattenning preserves existing display |
| AddChapterForm target volume | First volume (`volumes[0]`) | Single-volume assumption; safe for current data |
| Route nesting | Deep: `volumes/[volumeId]/chapters/[chapterId]` | Matches API hierarchy; `volumeId` available in params for all API calls |

---

## Files Changed

| Action | Path |
|--------|------|
| Modify | `apps/web/app/types.ts` |
| Modify | `apps/web/app/novels/[id]/page.tsx` |
| Modify | `apps/web/app/novels/[id]/AddChapterForm.tsx` |
| Modify | `apps/web/app/novels/[id]/ChapterListWithFilters.tsx` |
| Move + modify | `apps/web/app/novels/[id]/chapters/[chapterId]/page.tsx` → `volumes/[volumeId]/chapters/[chapterId]/page.tsx` |
| Move + modify | `apps/web/app/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx` → `volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx` |
| Move | `apps/web/app/novels/[id]/chapters/[chapterId]/SummaryRenderer.tsx` → `volumes/[volumeId]/chapters/[chapterId]/SummaryRenderer.tsx` |
| Move | `apps/web/app/novels/[id]/chapters/[chapterId]/LinkedCharactersPanel.tsx` → `volumes/[volumeId]/chapters/[chapterId]/LinkedCharactersPanel.tsx` |

---

## Design

### 1. `types.ts`

- Add `Volume` interface:
  ```ts
  export interface Volume {
    id: string
    novel_id: string
    number: number
    title: string
    created_at: string
    updated_at: string
  }
  ```
- `Chapter`: replace `novel_id: string` → `volume_id: string`

### 2. Novel page (`novels/[id]/page.tsx`)

Replace `getChapters(id)` with:

```ts
async function getVolumes(novelId: string): Promise<Volume[]>
// GET /api/v1/novels/:id/volumes

async function getChaptersByVolume(novelId: string, volumeId: string): Promise<Chapter[]>
// GET /api/v1/novels/:id/volumes/:volumeId/chapters
```

In the page:
1. `getVolumes(id)` → `volumes`
2. `Promise.all(volumes.map(v => getChaptersByVolume(id, v.id)))` → flatten to `chapters`
3. Pass `volumes[0]?.id ?? ''` to `AddChapterForm` as `volumeId` prop

### 3. `AddChapterForm`

- Prop: `volumeId: string` (added alongside existing `novelId`)
- POST URL: `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`

### 4. `ChapterListWithFilters`

- Prop: no change to signature (already receives `chapters: Chapter[]`)
- Chapter link `href`: `/novels/${novelId}/volumes/${chapter.volume_id}/chapters/${chapter.id}`

### 5. Route — move chapter folder

Old: `app/novels/[id]/chapters/[chapterId]/`
New: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/`

Delete old folder after moving all 4 files.

### 6. Chapter page (`volumes/[volumeId]/chapters/[chapterId]/page.tsx`)

- Params: `{ id: string; volumeId: string; chapterId: string }`
- `getChapter` fetch: `GET /api/v1/novels/${id}/volumes/${volumeId}/chapters/${chapterId}`
- Back link: `/novels/${id}` (unchanged)
- Props to `ChapterEditor`: add `volumeId`

### 7. `ChapterEditor`

- New prop: `volumeId: string`
- 4 URL updates:
  - `saveSummary` / `saveReadAt` PATCH: `/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}`
  - `linkTag` POST: `/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags`
  - `handleRemoveTag` DELETE: `/novels/${novelId}/volumes/${volumeId}/chapters/${chapter.id}/tags/${tagId}`
- Tags list fetch (`ensureTagListLoaded`): `/novels/${novelId}/tags` — **unchanged** (tags are novel-scoped)

### 8. `SummaryRenderer.tsx` / `LinkedCharactersPanel.tsx`

Move only — no code changes needed.

---

## What does NOT change

- Characters routes (`/novels/:id/characters/...`) — unchanged
- Timeline page — unchanged
- Novel list / novel CRUD — unchanged
- Tags list fetch in ChapterEditor — novel-scoped, unchanged
- Search — unchanged

---

## TODO (future)

- Volume management UI: create, rename, delete volumes
- Group chapters by volume on novel page
- Multi-volume `AddChapterForm`: volume picker instead of auto-first
