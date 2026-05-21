# Volume Layer Design

**Date:** 2026-05-21  
**Status:** Approved  
**Scope:** API + DB only

---

## Problem

Novel chapters are currently direct children of novels (`Novel → Chapter`). The new hierarchy is `Novel → Volume → Chapter`, where volumes group chapters into arcs, books, or parts.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Chapter FK | `volume_id` only (pure replacement) | No denormalization; `novel_id` derivable via JOIN |
| Chapter number scope | Novel-scoped | Numbers are continuous across volumes (ch 1–500 total) |
| Chapter number uniqueness | `UNIQUE(volume_id, number)` in DB, cross-volume check in usecase | DB constraint is per-volume; usecase enforces no duplicate number across novel |
| Route structure | Deep nested | `/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/...` |
| Data migration | Create "Volume 1" per novel, move all chapters there | Safe; no data loss |

---

## Database

### Migration 000010 — create_volumes

```sql
-- up
CREATE TABLE volumes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id   UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  number     INT NOT NULL,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, number)
);
CREATE INDEX idx_volumes_novel_id ON volumes(novel_id);

-- down
DROP TABLE IF EXISTS volumes;
```

### Migration 000011 — add_volume_to_chapters

```sql
-- up (single transaction)
-- 1. Add nullable volume_id
ALTER TABLE chapters ADD COLUMN volume_id UUID REFERENCES volumes(id) ON DELETE CASCADE;

-- 2. Create default Volume 1 for each novel
INSERT INTO volumes (novel_id, number, title)
SELECT id, 1, 'Volume 1' FROM novels;

-- 3. Assign all existing chapters to their novel's default volume
UPDATE chapters
SET volume_id = (
  SELECT v.id FROM volumes v WHERE v.novel_id = chapters.novel_id LIMIT 1
);

-- 4. Enforce NOT NULL
ALTER TABLE chapters ALTER COLUMN volume_id SET NOT NULL;

-- 5. Drop old novel_id column and its index/constraint
DROP INDEX IF EXISTS idx_chapters_novel_id;
ALTER TABLE chapters DROP COLUMN novel_id;

-- 6. Replace unique constraint
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_novel_id_number_key;
ALTER TABLE chapters ADD CONSTRAINT chapters_volume_id_number_key UNIQUE (volume_id, number);

-- 7. Add new index
CREATE INDEX idx_chapters_volume_id ON chapters(volume_id);

-- down
ALTER TABLE chapters ADD COLUMN novel_id UUID;
UPDATE chapters c
SET novel_id = (SELECT v.novel_id FROM volumes v WHERE v.id = c.volume_id);
ALTER TABLE chapters ALTER COLUMN novel_id SET NOT NULL;
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_volume_id_number_key;
ALTER TABLE chapters ADD CONSTRAINT chapters_novel_id_number_key UNIQUE (novel_id, number);
DROP INDEX IF EXISTS idx_chapters_volume_id;
CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);
ALTER TABLE chapters DROP COLUMN volume_id;
```

### Search vector

`search_vector` on chapters is a generated column — no change needed. Search repo query updated to JOIN volumes for novel-scoped filtering.

---

## Domain

### New file: `internal/domain/volume.go`

```go
type Volume struct {
    ID        string    `json:"id"`
    NovelID   string    `json:"novel_id"`
    Number    int       `json:"number"`
    Title     string    `json:"title"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type VolumeRepository interface {
    List(ctx context.Context, novelID string) ([]Volume, error)
    Create(ctx context.Context, v *Volume) error
    GetByID(ctx context.Context, novelID, id string) (*Volume, error)
    Update(ctx context.Context, v *Volume) error
    Delete(ctx context.Context, novelID, id string) error
}
```

### Updated: `internal/domain/chapter.go`

- Replace `NovelID string` with `VolumeID string`
- `ChapterRepository` methods take `volumeID` instead of `novelID`

```go
type ChapterRepository interface {
    List(ctx context.Context, volumeID string) ([]Chapter, error)
    Create(ctx context.Context, ch *Chapter) error
    GetByID(ctx context.Context, volumeID, id string) (*Chapter, error)
    Update(ctx context.Context, ch *Chapter) error
    Delete(ctx context.Context, volumeID, id string) error
    NumberExistsInNovel(ctx context.Context, novelID string, number int, excludeID string) (bool, error)
}
```

`NumberExistsInNovel` used by usecase to enforce novel-scoped chapter number uniqueness across volumes.

---

## Repository

### New: `internal/repository/volume_repo.go`

Standard pgx CRUD. `GetByID` validates `novel_id` ownership. `Delete` cascades to chapters via FK.

### Updated: `internal/repository/chapter_repo.go`

- All queries use `volume_id` not `novel_id`
- `NumberExistsInNovel`: `SELECT EXISTS(SELECT 1 FROM chapters c JOIN volumes v ON v.id=c.volume_id WHERE v.novel_id=$1 AND c.number=$2 AND c.id!=$3)`

### Updated: `internal/repository/search_repo.go`

`SearchChapters` updated:
```sql
SELECT c.id, c.number, c.title, ts_headline(...) 
FROM chapters c
JOIN volumes v ON v.id = c.volume_id, to_tsquery('simple', $1 || ':*') query
WHERE v.novel_id = $2
  AND c.search_vector @@ query
ORDER BY ts_rank(c.search_vector, query) DESC
LIMIT 10
```

---

## Usecase

### New: `internal/usecase/volume_usecase.go`

Validation: `number > 0`, `title` non-empty.

### Updated: `internal/usecase/chapter_usecase.go`

- Constructor takes `VolumeRepository` (for ownership verification)
- `Create`: resolve `novelID` from volume, check `NumberExistsInNovel` before insert
- `Update`: check `NumberExistsInNovel` excluding self before update
- `List(ctx, volumeID)` — volume-scoped

---

## Handler

### New: `internal/handler/volume_handler.go`

DTOs:
```go
type volumeCreateRequest struct {
    Number int    `json:"number"`
    Title  string `json:"title"`
}

type volumeUpdateRequest struct {
    Number *int    `json:"number"`
    Title  *string `json:"title"`
}
```

### Updated: `internal/handler/chapter_handler.go`

- Extract `volumeID` from URL param instead of `novelID`
- Pass `volumeID` to usecase

### Updated: `internal/handler/character_handler.go` + `tag_handler.go`

- Extract `volumeID` from URL (needed to resolve ownership chain for character/tag sub-routes)

---

## Routes

Full updated route table in `cmd/server/main.go`:

```
GET    /api/v1/novels/{novelID}/volumes
POST   /api/v1/novels/{novelID}/volumes
GET    /api/v1/novels/{novelID}/volumes/{volumeID}
PATCH  /api/v1/novels/{novelID}/volumes/{volumeID}
DELETE /api/v1/novels/{novelID}/volumes/{volumeID}

GET    /api/v1/novels/{novelID}/volumes/{volumeID}/chapters
POST   /api/v1/novels/{novelID}/volumes/{volumeID}/chapters
GET    /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}
PATCH  /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}
DELETE /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}

GET    /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters
POST   /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters
DELETE /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters/{characterID}

POST   /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags
DELETE /api/v1/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags/{tagID}

GET    /api/v1/novels/{novelID}/characters        (unchanged)
POST   /api/v1/novels/{novelID}/characters        (unchanged)
GET    /api/v1/novels/{novelID}/characters/{characterID}   (unchanged)
PATCH  /api/v1/novels/{novelID}/characters/{characterID}   (unchanged)
DELETE /api/v1/novels/{novelID}/characters/{characterID}   (unchanged)

GET    /api/v1/novels/{novelID}/events            (unchanged)
POST   /api/v1/novels/{novelID}/events            (unchanged)
PATCH  /api/v1/novels/{novelID}/events/{eventID}  (unchanged)
DELETE /api/v1/novels/{novelID}/events/{eventID}  (unchanged)
POST   /api/v1/novels/{novelID}/events/{eventID}/characters   (unchanged)
DELETE /api/v1/novels/{novelID}/events/{eventID}/characters/{characterID}  (unchanged)

GET    /api/v1/novels/{novelID}/tags              (unchanged)
POST   /api/v1/novels/{novelID}/tags              (unchanged)
DELETE /api/v1/novels/{novelID}/tags/{tagID}      (unchanged)

GET    /api/v1/novels/{novelID}/search            (unchanged, repo query updated)
```

---

## Docs Updated

- `docs/CONTEXT.md` — route table, folder structure, migration list, hierarchy description
- `README.md` — hierarchy section if present

---

## Out of Scope

- Frontend (`apps/web`) — not part of this change
- Auth (Phase 5 per ADR-003)
- Pagination (not yet implemented anywhere; no regression risk)
- Events `chapter_id` FK — still references `chapters(id)` directly, no change needed
