# Phase 2 — Characters + Cross-link Design

**Date:** 2026-05-20  
**Status:** Approved

---

## Overview

Add characters as a first-class entity, link them to chapters via a many-to-many join table, parse `[[Name]]` mentions in chapter summaries for auto-linking, and expose character profile pages with chapter appearance history.

---

## 1. Database

### Migration 000003 — characters

```sql
CREATE TABLE characters (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id                    UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  aliases                     TEXT[] DEFAULT '{}',
  role                        TEXT NOT NULL DEFAULT 'minor',
  description                 TEXT,
  first_appearance_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, name)
);
CREATE INDEX idx_characters_novel_id ON characters(novel_id);
```

### Migration 000004 — chapter_characters

```sql
CREATE TABLE chapter_characters (
  chapter_id   UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, character_id)
);
CREATE INDEX idx_chapter_characters_character_id ON chapter_characters(character_id);
```

Both migrations get corresponding `.down.sql` that DROP the table + indexes in reverse order.

---

## 2. Go API

### Layer additions (follows existing pattern)

```
internal/
  domain/character.go
  repository/character_repo.go
  usecase/character_usecase.go
  handler/character_handler.go
  util/mention.go
```

### DB driver note

Existing code uses `pgx/v5/pgxpool` (not `database/sql`+`lib/pq`). All new repo code follows the same pgx pattern.

### Domain struct

```go
type Character struct {
  ID                       string
  NovelID                  string
  Name                     string
  Aliases                  []string
  Role                     string   // 'protagonist' | 'supporting' | 'antagonist' | 'minor'
  Description              string
  FirstAppearanceChapterID *string
  ChapterCount             int       // populated in list query
  Chapters                 []ChapterSummary // populated in detail query only
  CreatedAt                time.Time
  UpdatedAt                time.Time
}

type ChapterSummary struct {
  ID     string
  Number int
  Title  string
  ReadAt *time.Time
}

type CharacterRepository interface {
  List(ctx, novelID) ([]Character, error)
  Create(ctx, *Character) error
  GetByID(ctx, novelID, id) (*Character, error)
  Update(ctx, *Character) error
  Delete(ctx, novelID, id) error
  ListByChapter(ctx, chapterID) ([]Character, error)
  LinkToChapter(ctx, chapterID, characterID) error
  UnlinkFromChapter(ctx, chapterID, characterID) error
  LinkMentions(ctx, chapterID, novelID string, names []string) error
}
```

### util/mention.go

```go
func ExtractMentions(text string) []string
// regex: \[\[([^\]]+)\]\]
// returns deduplicated slice of names
```

### REST endpoints (all under /api/v1)

**Characters CRUD:**
```
GET    /novels/{novelID}/characters
POST   /novels/{novelID}/characters          body: {name, role?, description?, aliases?}
GET    /novels/{novelID}/characters/{characterID}
PATCH  /novels/{novelID}/characters/{characterID}
DELETE /novels/{novelID}/characters/{characterID}
```

**Chapter ↔ Character links:**
```
GET    /novels/{novelID}/chapters/{chapterID}/characters
POST   /novels/{novelID}/chapters/{chapterID}/characters   body: {character_id}
DELETE /novels/{novelID}/chapters/{chapterID}/characters/{characterID}
```

### Chapter GET — enriched response

`GET /novels/{novelID}/chapters/{chapterID}` already exists. Its response will be extended to include `"characters": [...]` so the chapter page has everything in one call.

This requires:
- Updating `ChapterRepository` to have a `GetByIDWithCharacters` method, OR
- Letting `ChapterUsecase.GetByID` call `CharacterRepository.ListByChapter` after the chapter fetch

Chosen approach: **separate call in usecase** (no coupling between repos). Usecase returns a new `ChapterWithCharacters` type.

### ChapterUsecase dependency update

`ChapterUsecase` gains a second repo dependency:
```go
type ChapterUsecase struct {
  repo     domain.ChapterRepository
  charRepo domain.CharacterRepository
}
func NewChapterUsecase(repo domain.ChapterRepository, charRepo domain.CharacterRepository) *ChapterUsecase
```
`main.go` must wire `charRepo` before calling `NewChapterUsecase`.

### Auto-link on chapter summary save

In `ChapterUsecase.Update`, when `summary` changes:
1. Call `util.ExtractMentions(summary)` → `[]string`
2. `CharacterRepository.LinkMentions(ctx, chapterID, novelID, names)` — bulk upsert:
   - `SELECT id FROM characters WHERE novel_id=$1 AND name=ANY($2)`
   - `INSERT INTO chapter_characters ... ON CONFLICT DO NOTHING`
3. Existing links never deleted (additive only)

### Character list SQL

```sql
SELECT c.*, COUNT(cc.chapter_id) AS chapter_count
FROM characters c
LEFT JOIN chapter_characters cc ON cc.character_id = c.id
WHERE c.novel_id = $1
GROUP BY c.id
ORDER BY c.role, c.name
```

### Character detail SQL (chapters appeared in)

```sql
SELECT ch.id, ch.number, ch.title, ch.read_at
FROM chapters ch
JOIN chapter_characters cc ON cc.chapter_id = ch.id
WHERE cc.character_id = $1
ORDER BY ch.number ASC
```

### main.go additions

Wire up:
```go
characterRepo := repository.NewCharacterRepository(pool)
characterUC   := usecase.NewCharacterUsecase(characterRepo)
characterH    := handler.NewCharacterHandler(characterUC)
```

Register routes under `/api/v1`.

---

## 3. Next.js UI

### TypeScript types (apps/web/app/types.ts additions)

```ts
export interface Character {
  id: string
  novel_id: string
  name: string
  aliases: string[]
  role: 'protagonist' | 'supporting' | 'antagonist' | 'minor'
  description: string
  first_appearance_chapter_id: string | null
  chapter_count: number
  chapters?: ChapterSummary[]
  created_at: string
  updated_at: string
}

export interface ChapterSummary {
  id: string
  number: number
  title: string
  read_at: string | null
}

export interface ChapterWithCharacters extends Chapter {
  characters: Character[]
}
```

### New pages

**`/novels/[id]/characters/page.tsx`** — character list
- Server component, fetches `GET /novels/{id}/characters`
- Card grid or table: name, role badge, chapter_count, description preview
- Role badge colors: protagonist=blue, supporting=teal, antagonist=red, minor=gray
- Inline "Add character" form (client component, mirrors `AddChapterForm` pattern)
- Click → `/novels/[id]/characters/[characterId]`

**`/novels/[id]/characters/[characterId]/page.tsx`** — character profile
- Server component
- Header: name, role badge, aliases, description
- Edit button → inline edit mode (client component)
- "Appears in" section: list of chapter cards (number, title, read_at), each links to chapter page

### Modified pages

**`/novels/[id]/page.tsx`** — novel detail
- Add "Characters (N)" link/button alongside "Chapters" heading
- Fetch character count by adding `GET /novels/{id}/characters` call (or derive from existing data)

**`/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx`** — chapter editor
Extend with three additions:

**A) SummaryRenderer** (view mode):
- Parse `[[Name]]` in summary text
- Render each matched name as `<Link>` to character page if character exists in novel
- Unmatched names render as plain underlined text (no broken link)
- Character list fetched server-side and passed as prop

**B) `[[Name]]` autocomplete** (edit mode, in ChapterEditor client component):
- On textarea `onInput`: check text before cursor matches `/\[\[([^\]]*)$/`
- If match: show floating dropdown filtered by `includes(query)` on character names
- Keyboard: ArrowUp/Down, Enter to select, Escape to close
- On select: replace partial `[[...` with `[[FullName]]`
- Character list fetched once on component mount via `useEffect`

**C) Linked characters panel** (below summary):
- Show characters linked to this chapter (from enriched chapter response)
- "+ Link character" → searchable dropdown of unlinked characters
- × on each linked character → `DELETE .../characters/{id}` to unlink
- After link/unlink: call `router.refresh()`

### Nav

Add "Characters" link in novel detail page header/nav area, pointing to `/novels/[id]/characters`.

---

## 4. Constraints

- No auth — no user_id on any new table
- No pagination on list endpoints
- No avatar/image for characters
- Auto-link is additive only — never deletes existing `chapter_characters` rows
- `[[Name]]` with no matching character: skip silently
- Autocomplete: simple `includes` match, no fuzzy search
- `params` is `Promise<{...}>` in Next.js 16 — must be awaited

---

## 5. Files Affected

**New files:**
- `apps/api/migrations/000003_create_characters.up.sql`
- `apps/api/migrations/000003_create_characters.down.sql`
- `apps/api/migrations/000004_create_chapter_characters.up.sql`
- `apps/api/migrations/000004_create_chapter_characters.down.sql`
- `apps/api/internal/domain/character.go`
- `apps/api/internal/util/mention.go`
- `apps/api/internal/repository/character_repo.go`
- `apps/api/internal/usecase/character_usecase.go`
- `apps/api/internal/handler/character_handler.go`
- `apps/web/app/novels/[id]/characters/page.tsx`
- `apps/web/app/novels/[id]/characters/AddCharacterForm.tsx`
- `apps/web/app/novels/[id]/characters/[characterId]/page.tsx`
- `apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`
- `apps/web/app/novels/[id]/chapters/[chapterId]/SummaryRenderer.tsx`
- `apps/web/app/novels/[id]/chapters/[chapterId]/LinkedCharactersPanel.tsx`

**Modified files:**
- `apps/api/cmd/server/main.go` (wire + routes)
- `apps/api/internal/domain/chapter.go` (add ChapterSummary, ChapterWithCharacters)
- `apps/api/internal/usecase/chapter_usecase.go` (auto-link on update)
- `apps/api/internal/handler/chapter_handler.go` (return characters in GetByID)
- `apps/web/app/types.ts` (add Character, ChapterSummary, ChapterWithCharacters)
- `apps/web/app/novels/[id]/page.tsx` (add Characters link + count)
- `apps/web/app/novels/[id]/chapters/[chapterId]/page.tsx` (pass characters to editor)
- `apps/web/app/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx` (autocomplete + panel)
