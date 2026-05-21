# Volume Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `volumes` table between novels and chapters, wiring the full `Novel → Volume → Chapter` hierarchy throughout the API and database while safely migrating existing data.

**Architecture:** Pure FK replacement — `chapters.novel_id` is removed and replaced by `chapters.volume_id`. Novel ownership of chapters is derived by joining through volumes. Existing chapters are migrated to a generated "Volume 1" per novel. Chapter number uniqueness is novel-scoped, enforced in the usecase layer via a cross-volume SQL query. All chapter sub-resource routes (characters, tags) are deeply nested under volumes.

**Tech Stack:** Go 1.24, pgx/v5, chi v5, PostgreSQL 16, golang-migrate

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/api/migrations/000010_create_volumes.up.sql` |
| Create | `apps/api/migrations/000010_create_volumes.down.sql` |
| Create | `apps/api/migrations/000011_add_volume_to_chapters.up.sql` |
| Create | `apps/api/migrations/000011_add_volume_to_chapters.down.sql` |
| Create | `apps/api/internal/domain/volume.go` |
| Modify | `apps/api/internal/domain/chapter.go` |
| Create | `apps/api/internal/repository/volume_repo.go` |
| Modify | `apps/api/internal/repository/chapter_repo.go` |
| Modify | `apps/api/internal/repository/search_repo.go` |
| Create | `apps/api/internal/usecase/volume_usecase.go` |
| Create | `apps/api/internal/usecase/volume_usecase_test.go` |
| Modify | `apps/api/internal/usecase/chapter_usecase.go` |
| Create | `apps/api/internal/usecase/chapter_usecase_test.go` |
| Create | `apps/api/internal/handler/volume_handler.go` |
| Modify | `apps/api/internal/handler/chapter_handler.go` |
| Modify | `apps/api/cmd/server/main.go` |
| Modify | `docs/CONTEXT.md` |
| Modify | `README.md` |

---

### Task 1: Migration 000010 — create volumes table

**Files:**
- Create: `apps/api/migrations/000010_create_volumes.up.sql`
- Create: `apps/api/migrations/000010_create_volumes.down.sql`

- [ ] **Step 1: Write up migration**

`apps/api/migrations/000010_create_volumes.up.sql`:
```sql
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
```

- [ ] **Step 2: Write down migration**

`apps/api/migrations/000010_create_volumes.down.sql`:
```sql
DROP TABLE IF EXISTS volumes;
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/000010_create_volumes.up.sql apps/api/migrations/000010_create_volumes.down.sql
git commit -m "feat(db): add volumes table migration 000010"
```

---

### Task 2: Migration 000011 — move chapters to volume_id

**Files:**
- Create: `apps/api/migrations/000011_add_volume_to_chapters.up.sql`
- Create: `apps/api/migrations/000011_add_volume_to_chapters.down.sql`

- [ ] **Step 1: Write up migration**

`apps/api/migrations/000011_add_volume_to_chapters.up.sql`:
```sql
-- 1. Add nullable volume_id FK
ALTER TABLE chapters
  ADD COLUMN volume_id UUID REFERENCES volumes(id) ON DELETE CASCADE;

-- 2. Create default "Volume 1" for every existing novel
INSERT INTO volumes (novel_id, number, title)
SELECT id, 1, 'Volume 1' FROM novels;

-- 3. Assign every chapter to its novel's default volume
UPDATE chapters
SET volume_id = (
  SELECT v.id FROM volumes v WHERE v.novel_id = chapters.novel_id LIMIT 1
);

-- 4. Enforce NOT NULL
ALTER TABLE chapters ALTER COLUMN volume_id SET NOT NULL;

-- 5. Drop old index, unique constraint, and novel_id column
DROP INDEX IF EXISTS idx_chapters_novel_id;
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_novel_id_number_key;
ALTER TABLE chapters DROP COLUMN novel_id;

-- 6. Add volume-scoped unique constraint and index
ALTER TABLE chapters ADD CONSTRAINT chapters_volume_id_number_key UNIQUE (volume_id, number);
CREATE INDEX idx_chapters_volume_id ON chapters(volume_id);
```

- [ ] **Step 2: Write down migration**

`apps/api/migrations/000011_add_volume_to_chapters.down.sql`:
```sql
-- 1. Restore novel_id (nullable for population)
ALTER TABLE chapters ADD COLUMN novel_id UUID;

-- 2. Populate novel_id from volumes join (volumes still exist at this point)
UPDATE chapters
SET novel_id = (
  SELECT v.novel_id FROM volumes v WHERE v.id = chapters.volume_id
);

-- 3. Enforce NOT NULL
ALTER TABLE chapters ALTER COLUMN novel_id SET NOT NULL;

-- 4. Drop volume constraints and column
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_volume_id_number_key;
DROP INDEX IF EXISTS idx_chapters_volume_id;
ALTER TABLE chapters DROP COLUMN volume_id;

-- 5. Restore old index and unique constraint
ALTER TABLE chapters ADD CONSTRAINT chapters_novel_id_number_key UNIQUE (novel_id, number);
CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/000011_add_volume_to_chapters.up.sql apps/api/migrations/000011_add_volume_to_chapters.down.sql
git commit -m "feat(db): migrate chapters to volume_id with default Volume 1 per novel"
```

---

### Task 3: Volume domain type

**Files:**
- Create: `apps/api/internal/domain/volume.go`

- [ ] **Step 1: Write domain file**

`apps/api/internal/domain/volume.go`:
```go
package domain

import (
	"context"
	"time"
)

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

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/domain/volume.go
git commit -m "feat(domain): add Volume struct and VolumeRepository interface"
```

---

### Task 4: Update chapter domain

**Files:**
- Modify: `apps/api/internal/domain/chapter.go`

- [ ] **Step 1: Rewrite the file**

`apps/api/internal/domain/chapter.go`:
```go
package domain

import (
	"context"
	"time"
)

type Chapter struct {
	ID        string     `json:"id"`
	VolumeID  string     `json:"volume_id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Summary   string     `json:"summary"`
	ReadAt    *time.Time `json:"read_at"`
	Tags      []Tag      `json:"tags"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type ChapterWithCharacters struct {
	Chapter
	Characters []Character `json:"characters"`
}

type ChapterRepository interface {
	List(ctx context.Context, volumeID string) ([]Chapter, error)
	Create(ctx context.Context, ch *Chapter) error
	GetByID(ctx context.Context, volumeID, id string) (*Chapter, error)
	Update(ctx context.Context, ch *Chapter) error
	Delete(ctx context.Context, volumeID, id string) error
	// NumberExistsInNovel checks across all volumes of a novel to enforce novel-scoped uniqueness.
	// Pass excludeID="" when creating (no existing chapter to exclude).
	NumberExistsInNovel(ctx context.Context, novelID string, number int, excludeID string) (bool, error)
}
```

- [ ] **Step 2: Attempt build to surface all downstream errors**

```bash
cd apps/api && go build ./... 2>&1 | head -40
```

Expected: compile errors in `chapter_repo.go`, `chapter_usecase.go`, `chapter_handler.go` referencing `NovelID`. These are fixed in Tasks 6, 9, 11.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/domain/chapter.go
git commit -m "feat(domain): replace Chapter.NovelID with VolumeID, update ChapterRepository interface"
```

---

### Task 5: Volume repository

**Files:**
- Create: `apps/api/internal/repository/volume_repo.go`

- [ ] **Step 1: Write the file**

`apps/api/internal/repository/volume_repo.go`:
```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxVolumeRepo struct {
	pool *pgxpool.Pool
}

func NewVolumeRepository(pool *pgxpool.Pool) domain.VolumeRepository {
	return &pgxVolumeRepo{pool: pool}
}

func (r *pgxVolumeRepo) List(ctx context.Context, novelID string) ([]domain.Volume, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, novel_id, number, title, created_at, updated_at
		 FROM volumes WHERE novel_id=$1 ORDER BY number ASC`,
		novelID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volumes []domain.Volume
	for rows.Next() {
		var v domain.Volume
		if err := rows.Scan(&v.ID, &v.NovelID, &v.Number, &v.Title, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		volumes = append(volumes, v)
	}
	return volumes, rows.Err()
}

func (r *pgxVolumeRepo) Create(ctx context.Context, v *domain.Volume) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO volumes (novel_id, number, title, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		v.NovelID, v.Number, v.Title, v.CreatedAt, v.UpdatedAt,
	).Scan(&v.ID)
}

func (r *pgxVolumeRepo) GetByID(ctx context.Context, novelID, id string) (*domain.Volume, error) {
	var v domain.Volume
	err := r.pool.QueryRow(ctx,
		`SELECT id, novel_id, number, title, created_at, updated_at
		 FROM volumes WHERE id=$1 AND novel_id=$2`,
		id, novelID,
	).Scan(&v.ID, &v.NovelID, &v.Number, &v.Title, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

func (r *pgxVolumeRepo) Update(ctx context.Context, v *domain.Volume) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE volumes SET number=$3, title=$4, updated_at=NOW()
		 WHERE id=$1 AND novel_id=$2 RETURNING updated_at`,
		v.ID, v.NovelID, v.Number, v.Title,
	).Scan(&v.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxVolumeRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM volumes WHERE id=$1 AND novel_id=$2`, id, novelID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/repository/volume_repo.go
git commit -m "feat(repo): add volume repository"
```

---

### Task 6: Update chapter repository

**Files:**
- Modify: `apps/api/internal/repository/chapter_repo.go`

- [ ] **Step 1: Rewrite the file**

`apps/api/internal/repository/chapter_repo.go`:
```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxChapterRepo struct {
	pool *pgxpool.Pool
}

func NewChapterRepository(pool *pgxpool.Pool) domain.ChapterRepository {
	return &pgxChapterRepo{pool: pool}
}

func (r *pgxChapterRepo) List(ctx context.Context, volumeID string) ([]domain.Chapter, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, volume_id, number, title, summary, read_at, created_at, updated_at
		 FROM chapters WHERE volume_id=$1 ORDER BY number ASC`,
		volumeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chapters []domain.Chapter
	for rows.Next() {
		var ch domain.Chapter
		if err := rows.Scan(&ch.ID, &ch.VolumeID, &ch.Number, &ch.Title, &ch.Summary, &ch.ReadAt, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		chapters = append(chapters, ch)
	}
	return chapters, rows.Err()
}

func (r *pgxChapterRepo) Create(ctx context.Context, ch *domain.Chapter) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO chapters (volume_id, number, title, summary, read_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		ch.VolumeID, ch.Number, ch.Title, ch.Summary, ch.ReadAt, ch.CreatedAt, ch.UpdatedAt,
	).Scan(&ch.ID)
}

func (r *pgxChapterRepo) GetByID(ctx context.Context, volumeID, id string) (*domain.Chapter, error) {
	var ch domain.Chapter
	err := r.pool.QueryRow(ctx,
		`SELECT id, volume_id, number, title, summary, read_at, created_at, updated_at
		 FROM chapters WHERE id=$1 AND volume_id=$2`,
		id, volumeID,
	).Scan(&ch.ID, &ch.VolumeID, &ch.Number, &ch.Title, &ch.Summary, &ch.ReadAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &ch, nil
}

func (r *pgxChapterRepo) Update(ctx context.Context, ch *domain.Chapter) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE chapters SET number=$3, title=$4, summary=$5, read_at=$6, updated_at=NOW()
		 WHERE id=$1 AND volume_id=$2 RETURNING updated_at`,
		ch.ID, ch.VolumeID, ch.Number, ch.Title, ch.Summary, ch.ReadAt,
	).Scan(&ch.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxChapterRepo) Delete(ctx context.Context, volumeID, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM chapters WHERE id=$1 AND volume_id=$2`, id, volumeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxChapterRepo) NumberExistsInNovel(ctx context.Context, novelID string, number int, excludeID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM chapters c
			JOIN volumes v ON v.id = c.volume_id
			WHERE v.novel_id = $1
			  AND c.number = $2
			  AND (length($3) = 0 OR c.id::text != $3)
		)`,
		novelID, number, excludeID,
	).Scan(&exists)
	return exists, err
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/repository/chapter_repo.go
git commit -m "feat(repo): update chapter repository for volume_id"
```

---

### Task 7: Update search repository

**Files:**
- Modify: `apps/api/internal/repository/search_repo.go`

- [ ] **Step 1: Replace `SearchChapters` method**

In `apps/api/internal/repository/search_repo.go`, replace the `SearchChapters` method with:

```go
func (r *pgxSearchRepo) SearchChapters(ctx context.Context, novelID, tsQuery string) ([]domain.ChapterSnippet, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.number, c.title,
		  ts_headline('simple', coalesce(c.summary,''), query,
		    'MaxWords=15, MinWords=8, StartSel=<mark>, StopSel=</mark>'
		  ) AS summary_snippet
		FROM chapters c
		JOIN volumes v ON v.id = c.volume_id,
		to_tsquery('simple', $1 || ':*') query
		WHERE v.novel_id = $2
		  AND c.search_vector @@ query
		ORDER BY ts_rank(c.search_vector, query) DESC
		LIMIT 10
	`, tsQuery, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.ChapterSnippet
	for rows.Next() {
		var s domain.ChapterSnippet
		if err := rows.Scan(&s.ID, &s.Number, &s.Title, &s.SummarySnippet); err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []domain.ChapterSnippet{}
	}
	return results, rows.Err()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/repository/search_repo.go
git commit -m "feat(repo): update SearchChapters to join volumes for novel-scoped filtering"
```

---

### Task 8: Volume usecase (TDD)

**Files:**
- Create: `apps/api/internal/usecase/volume_usecase_test.go`
- Create: `apps/api/internal/usecase/volume_usecase.go`

- [ ] **Step 1: Write failing tests**

`apps/api/internal/usecase/volume_usecase_test.go`:
```go
package usecase_test

import (
	"context"
	"testing"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type mockVolumeRepo struct {
	createErr error
}

func (m *mockVolumeRepo) List(_ context.Context, _ string) ([]domain.Volume, error) {
	return nil, nil
}
func (m *mockVolumeRepo) Create(_ context.Context, _ *domain.Volume) error { return m.createErr }
func (m *mockVolumeRepo) GetByID(_ context.Context, _, _ string) (*domain.Volume, error) {
	return nil, domain.ErrNotFound
}
func (m *mockVolumeRepo) Update(_ context.Context, _ *domain.Volume) error { return nil }
func (m *mockVolumeRepo) Delete(_ context.Context, _, _ string) error      { return nil }

func TestVolumeUsecase_Create_Validation(t *testing.T) {
	uc := usecase.NewVolumeUsecase(&mockVolumeRepo{})

	tests := []struct {
		name    string
		vol     domain.Volume
		wantErr string
	}{
		{"zero number", domain.Volume{NovelID: "n1", Number: 0, Title: "Vol 1"}, "number must be greater than 0"},
		{"negative number", domain.Volume{NovelID: "n1", Number: -1, Title: "Vol 1"}, "number must be greater than 0"},
		{"empty title", domain.Volume{NovelID: "n1", Number: 1, Title: ""}, "title is required"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.vol
			err := uc.Create(context.Background(), &v)
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantErr)
			}
			if err.Error() != tc.wantErr {
				t.Errorf("got %q, want %q", err.Error(), tc.wantErr)
			}
		})
	}
}

func TestVolumeUsecase_Create_Valid(t *testing.T) {
	uc := usecase.NewVolumeUsecase(&mockVolumeRepo{})
	v := domain.Volume{NovelID: "n1", Number: 1, Title: "Volume 1"}
	if err := uc.Create(context.Background(), &v); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.CreatedAt.IsZero() {
		t.Error("CreatedAt not set by usecase")
	}
}
```

- [ ] **Step 2: Run — expect compile error**

```bash
cd apps/api && go test ./internal/usecase/... -run TestVolume 2>&1 | head -15
```

Expected: `undefined: usecase.NewVolumeUsecase`

- [ ] **Step 3: Write implementation**

`apps/api/internal/usecase/volume_usecase.go`:
```go
package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type VolumeUsecase struct {
	repo domain.VolumeRepository
}

func NewVolumeUsecase(repo domain.VolumeRepository) *VolumeUsecase {
	return &VolumeUsecase{repo: repo}
}

func (u *VolumeUsecase) List(ctx context.Context, novelID string) ([]domain.Volume, error) {
	volumes, err := u.repo.List(ctx, novelID)
	if err != nil {
		return nil, err
	}
	if volumes == nil {
		volumes = []domain.Volume{}
	}
	return volumes, nil
}

func (u *VolumeUsecase) Create(ctx context.Context, v *domain.Volume) error {
	if v.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if v.Title == "" {
		return errors.New("title is required")
	}
	now := time.Now()
	v.CreatedAt = now
	v.UpdatedAt = now
	return u.repo.Create(ctx, v)
}

func (u *VolumeUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Volume, error) {
	return u.repo.GetByID(ctx, novelID, id)
}

func (u *VolumeUsecase) Update(ctx context.Context, v *domain.Volume) error {
	if v.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if v.Title == "" {
		return errors.New("title is required")
	}
	return u.repo.Update(ctx, v)
}

func (u *VolumeUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && go test ./internal/usecase/... -run TestVolume -v
```

Expected:
```
--- PASS: TestVolumeUsecase_Create_Validation/zero_number (0.00s)
--- PASS: TestVolumeUsecase_Create_Validation/negative_number (0.00s)
--- PASS: TestVolumeUsecase_Create_Validation/empty_title (0.00s)
--- PASS: TestVolumeUsecase_Create_Valid (0.00s)
PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/internal/usecase/volume_usecase.go apps/api/internal/usecase/volume_usecase_test.go
git commit -m "feat(usecase): add volume usecase with validation"
```

---

### Task 9: Update chapter usecase (TDD)

**Files:**
- Create: `apps/api/internal/usecase/chapter_usecase_test.go`
- Modify: `apps/api/internal/usecase/chapter_usecase.go`

Key changes: `Create` and `Update` gain a `novelID string` parameter; `ch.NovelID` refs replaced; novel-scoped number uniqueness check added.

- [ ] **Step 1: Write failing tests**

`apps/api/internal/usecase/chapter_usecase_test.go`:
```go
package usecase_test

import (
	"context"
	"testing"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type mockChapterRepo struct {
	numberExists bool
	numberErr    error
	createErr    error
}

func (m *mockChapterRepo) List(_ context.Context, _ string) ([]domain.Chapter, error) { return nil, nil }
func (m *mockChapterRepo) Create(_ context.Context, ch *domain.Chapter) error {
	ch.ID = "test-id"
	return m.createErr
}
func (m *mockChapterRepo) GetByID(_ context.Context, _, _ string) (*domain.Chapter, error) {
	return nil, nil
}
func (m *mockChapterRepo) Update(_ context.Context, _ *domain.Chapter) error { return nil }
func (m *mockChapterRepo) Delete(_ context.Context, _, _ string) error        { return nil }
func (m *mockChapterRepo) NumberExistsInNovel(_ context.Context, _ string, _ int, _ string) (bool, error) {
	return m.numberExists, m.numberErr
}

type mockCharRepoStub struct{}

func (m *mockCharRepoStub) List(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) Create(_ context.Context, _ *domain.Character) error { return nil }
func (m *mockCharRepoStub) GetByID(_ context.Context, _, _ string) (*domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) Update(_ context.Context, _ *domain.Character) error { return nil }
func (m *mockCharRepoStub) Delete(_ context.Context, _, _ string) error          { return nil }
func (m *mockCharRepoStub) ListByChapter(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) LinkToChapter(_ context.Context, _, _ string) error    { return nil }
func (m *mockCharRepoStub) UnlinkFromChapter(_ context.Context, _, _ string) error { return nil }
func (m *mockCharRepoStub) LinkMentions(_ context.Context, _, _ string, _ []string) error {
	return nil
}

type mockTagRepoStub struct{}

func (m *mockTagRepoStub) ListByNovel(_ context.Context, _ string) ([]domain.Tag, error) {
	return nil, nil
}
func (m *mockTagRepoStub) Create(_ context.Context, _ *domain.Tag) error { return nil }
func (m *mockTagRepoStub) Delete(_ context.Context, _, _ string) error   { return nil }
func (m *mockTagRepoStub) ListByChapter(_ context.Context, _ string) ([]domain.Tag, error) {
	return nil, nil
}
func (m *mockTagRepoStub) LinkToChapter(_ context.Context, _, _ string) error    { return nil }
func (m *mockTagRepoStub) UnlinkFromChapter(_ context.Context, _, _ string) error { return nil }

func newTestChapterUsecase(cr *mockChapterRepo) *usecase.ChapterUsecase {
	return usecase.NewChapterUsecase(cr, &mockCharRepoStub{}, &mockTagRepoStub{})
}

func TestChapterUsecase_Create_MissingVolumeID(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{})
	ch := domain.Chapter{Number: 5, Title: "Ch 5"}
	err := uc.Create(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "volume_id is required" {
		t.Errorf("got %v, want %q", err, "volume_id is required")
	}
}

func TestChapterUsecase_Create_DuplicateNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: true})
	ch := domain.Chapter{VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	err := uc.Create(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "chapter number already exists in this novel" {
		t.Errorf("got %v, want %q", err, "chapter number already exists in this novel")
	}
}

func TestChapterUsecase_Create_UniqueNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: false})
	ch := domain.Chapter{VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	if err := uc.Create(context.Background(), "novel-1", &ch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestChapterUsecase_Update_DuplicateNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: true})
	ch := domain.Chapter{ID: "ch-1", VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	err := uc.Update(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "chapter number already exists in this novel" {
		t.Errorf("got %v, want %q", err, "chapter number already exists in this novel")
	}
}
```

- [ ] **Step 2: Run — expect compile error**

```bash
cd apps/api && go test ./internal/usecase/... -run TestChapter 2>&1 | head -15
```

Expected: `uc.Create` signature mismatch (missing `novelID` param).

- [ ] **Step 3: Rewrite chapter usecase**

`apps/api/internal/usecase/chapter_usecase.go`:
```go
package usecase

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/util"
)

type ChapterUsecase struct {
	repo     domain.ChapterRepository
	charRepo domain.CharacterRepository
	tagRepo  domain.TagRepository
}

func NewChapterUsecase(repo domain.ChapterRepository, charRepo domain.CharacterRepository, tagRepo domain.TagRepository) *ChapterUsecase {
	return &ChapterUsecase{repo: repo, charRepo: charRepo, tagRepo: tagRepo}
}

func (u *ChapterUsecase) List(ctx context.Context, volumeID string) ([]domain.Chapter, error) {
	chapters, err := u.repo.List(ctx, volumeID)
	if err != nil {
		return nil, err
	}
	for i := range chapters {
		tags, err := u.tagRepo.ListByChapter(ctx, chapters[i].ID)
		if err != nil {
			return nil, err
		}
		if tags == nil {
			tags = []domain.Tag{}
		}
		chapters[i].Tags = tags
	}
	return chapters, nil
}

func (u *ChapterUsecase) Create(ctx context.Context, novelID string, ch *domain.Chapter) error {
	if ch.VolumeID == "" {
		return errors.New("volume_id is required")
	}
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	exists, err := u.repo.NumberExistsInNovel(ctx, novelID, ch.Number, "")
	if err != nil {
		return err
	}
	if exists {
		return errors.New("chapter number already exists in this novel")
	}
	now := time.Now()
	ch.CreatedAt = now
	ch.UpdatedAt = now
	return u.repo.Create(ctx, ch)
}

func (u *ChapterUsecase) GetByID(ctx context.Context, volumeID, id string) (*domain.Chapter, error) {
	return u.repo.GetByID(ctx, volumeID, id)
}

func (u *ChapterUsecase) GetByIDWithCharacters(ctx context.Context, volumeID, id string) (*domain.ChapterWithCharacters, error) {
	ch, err := u.repo.GetByID(ctx, volumeID, id)
	if err != nil {
		return nil, err
	}
	chars, err := u.charRepo.ListByChapter(ctx, id)
	if err != nil {
		return nil, err
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	tags, err := u.tagRepo.ListByChapter(ctx, id)
	if err != nil {
		return nil, err
	}
	if tags == nil {
		tags = []domain.Tag{}
	}
	ch.Tags = tags
	return &domain.ChapterWithCharacters{Chapter: *ch, Characters: chars}, nil
}

func (u *ChapterUsecase) Update(ctx context.Context, novelID string, ch *domain.Chapter) error {
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	exists, err := u.repo.NumberExistsInNovel(ctx, novelID, ch.Number, ch.ID)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("chapter number already exists in this novel")
	}
	if err := u.repo.Update(ctx, ch); err != nil {
		return err
	}
	if ch.Summary != "" {
		names := util.ExtractMentions(ch.Summary)
		if len(names) > 0 {
			if err := u.charRepo.LinkMentions(ctx, ch.ID, novelID, names); err != nil {
				log.Printf("warn: LinkMentions chapter=%s: %v", ch.ID, err)
			}
		}
	}
	return nil
}

func (u *ChapterUsecase) Delete(ctx context.Context, volumeID, id string) error {
	return u.repo.Delete(ctx, volumeID, id)
}
```

- [ ] **Step 4: Run all usecase tests — expect PASS**

```bash
cd apps/api && go test ./internal/usecase/... -v 2>&1 | grep -E "^(---|\s*(PASS|FAIL)|PASS|FAIL)"
```

Expected:
```
--- PASS: TestVolumeUsecase_Create_Validation/zero_number
--- PASS: TestVolumeUsecase_Create_Validation/negative_number
--- PASS: TestVolumeUsecase_Create_Validation/empty_title
--- PASS: TestVolumeUsecase_Create_Valid
--- PASS: TestChapterUsecase_Create_MissingVolumeID
--- PASS: TestChapterUsecase_Create_DuplicateNumber
--- PASS: TestChapterUsecase_Create_UniqueNumber
--- PASS: TestChapterUsecase_Update_DuplicateNumber
PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/internal/usecase/chapter_usecase.go apps/api/internal/usecase/chapter_usecase_test.go
git commit -m "feat(usecase): update chapter usecase for volume hierarchy and novel-scoped number uniqueness"
```

---

### Task 10: Volume handler

**Files:**
- Create: `apps/api/internal/handler/volume_handler.go`

- [ ] **Step 1: Write the file**

`apps/api/internal/handler/volume_handler.go`:
```go
package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type VolumeHandler struct {
	uc *usecase.VolumeUsecase
}

func NewVolumeHandler(uc *usecase.VolumeUsecase) *VolumeHandler {
	return &VolumeHandler{uc: uc}
}

type volumeCreateRequest struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
}

type volumeUpdateRequest struct {
	Number *int    `json:"number"`
	Title  *string `json:"title"`
}

func (h *VolumeHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumes, err := h.uc.List(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": volumes})
}

func (h *VolumeHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req volumeCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	v := &domain.Volume{
		NovelID: novelID,
		Number:  req.Number,
		Title:   req.Title,
	}
	if err := h.uc.Create(r.Context(), v); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": v})
}

func (h *VolumeHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	v, err := h.uc.GetByID(r.Context(), novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": v})
}

func (h *VolumeHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")

	v, err := h.uc.GetByID(r.Context(), novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req volumeUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Number != nil {
		v.Number = *req.Number
	}
	if req.Title != nil {
		v.Title = *req.Title
	}

	if err := h.uc.Update(r.Context(), v); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": v})
}

func (h *VolumeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	if err := h.uc.Delete(r.Context(), novelID, volumeID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/handler/volume_handler.go
git commit -m "feat(handler): add volume handler"
```

---

### Task 11: Update chapter handler

**Files:**
- Modify: `apps/api/internal/handler/chapter_handler.go`

- [ ] **Step 1: Rewrite the file**

`apps/api/internal/handler/chapter_handler.go`:
```go
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type ChapterHandler struct {
	uc       *usecase.ChapterUsecase
	volumeUC *usecase.VolumeUsecase
}

func NewChapterHandler(uc *usecase.ChapterUsecase, volumeUC *usecase.VolumeUsecase) *ChapterHandler {
	return &ChapterHandler{uc: uc, volumeUC: volumeUC}
}

type chapterCreateRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	ReadAt  string `json:"read_at"`
}

type chapterUpdateRequest struct {
	Number  *int    `json:"number"`
	Title   *string `json:"title"`
	Summary *string `json:"summary"`
	ReadAt  *string `json:"read_at"`
}

func parseReadAt(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, errors.New("read_at must be in YYYY-MM-DD format")
	}
	return &t, nil
}

// resolveVolume verifies volumeID belongs to novelID. Writes error and returns false on failure.
func (h *ChapterHandler) resolveVolume(ctx context.Context, w http.ResponseWriter, novelID, volumeID string) bool {
	_, err := h.volumeUC.GetByID(ctx, novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return false
	}
	return true
}

func (h *ChapterHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	chapters, err := h.uc.List(r.Context(), volumeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chapters == nil {
		chapters = []domain.Chapter{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chapters})
}

func (h *ChapterHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	var req chapterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	readAt, err := parseReadAt(req.ReadAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ch := &domain.Chapter{
		VolumeID: volumeID,
		Number:   req.Number,
		Title:    req.Title,
		Summary:  req.Summary,
		ReadAt:   readAt,
	}
	if err := h.uc.Create(r.Context(), novelID, ch); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": ch})
}

func (h *ChapterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	ch, err := h.uc.GetByIDWithCharacters(r.Context(), volumeID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}

func (h *ChapterHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}

	ch, err := h.uc.GetByID(r.Context(), volumeID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req chapterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Number != nil {
		ch.Number = *req.Number
	}
	if req.Title != nil {
		ch.Title = *req.Title
	}
	if req.Summary != nil {
		ch.Summary = *req.Summary
	}
	if req.ReadAt != nil {
		readAt, err := parseReadAt(*req.ReadAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		ch.ReadAt = readAt
	}

	if err := h.uc.Update(r.Context(), novelID, ch); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}

func (h *ChapterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	if err := h.uc.Delete(r.Context(), volumeID, chapterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/internal/handler/chapter_handler.go
git commit -m "feat(handler): update chapter handler for volume hierarchy"
```

---

### Task 12: Update main.go

**Files:**
- Modify: `apps/api/cmd/server/main.go`

- [ ] **Step 1: Rewrite `apps/api/cmd/server/main.go`**

Replace the entire file (keep `corsMiddleware` and `connectDB` functions unchanged at the bottom):

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/Namchok/noveldex/api/internal/config"
	"github.com/Namchok/noveldex/api/internal/handler"
	"github.com/Namchok/noveldex/api/internal/repository"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	pool := connectDB(cfg.DatabaseURL)
	if pool != nil {
		defer pool.Close()
	}

	novelRepo := repository.NewNovelRepository(pool)
	novelUC := usecase.NewNovelUsecase(novelRepo)
	novelH := handler.NewNovelHandler(novelUC)

	characterRepo := repository.NewCharacterRepository(pool)
	characterUC := usecase.NewCharacterUsecase(characterRepo)
	characterH := handler.NewCharacterHandler(characterUC)

	tagRepo := repository.NewTagRepository(pool)
	tagUC := usecase.NewTagUsecase(tagRepo)
	tagH := handler.NewTagHandler(tagUC)

	volumeRepo := repository.NewVolumeRepository(pool)
	volumeUC := usecase.NewVolumeUsecase(volumeRepo)
	volumeH := handler.NewVolumeHandler(volumeUC)

	chapterRepo := repository.NewChapterRepository(pool)
	chapterUC := usecase.NewChapterUsecase(chapterRepo, characterRepo, tagRepo)
	chapterH := handler.NewChapterHandler(chapterUC, volumeUC)

	eventRepo := repository.NewEventRepository(pool)
	eventUC := usecase.NewEventUsecase(eventRepo)
	eventH := handler.NewEventHandler(eventUC)

	searchRepo := repository.NewSearchRepository(pool)
	searchUC := usecase.NewSearchUsecase(searchRepo)
	searchH := handler.NewSearchHandler(searchUC)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware(cfg.CORSAllowedOrigins))

	r.Get("/health", handler.Health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/novels", novelH.List)
		r.Post("/novels", novelH.Create)
		r.Get("/novels/{id}", novelH.GetByID)
		r.Patch("/novels/{id}", novelH.Update)
		r.Delete("/novels/{id}", novelH.Delete)

		r.Get("/novels/{novelID}/volumes", volumeH.List)
		r.Post("/novels/{novelID}/volumes", volumeH.Create)
		r.Get("/novels/{novelID}/volumes/{volumeID}", volumeH.GetByID)
		r.Patch("/novels/{novelID}/volumes/{volumeID}", volumeH.Update)
		r.Delete("/novels/{novelID}/volumes/{volumeID}", volumeH.Delete)

		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters", chapterH.List)
		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters", chapterH.Create)
		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.GetByID)
		r.Patch("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.Update)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}", chapterH.Delete)

		r.Get("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters", characterH.ListByChapter)
		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters", characterH.LinkToChapter)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/characters/{characterID}", characterH.UnlinkFromChapter)

		r.Post("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags", tagH.LinkToChapter)
		r.Delete("/novels/{novelID}/volumes/{volumeID}/chapters/{chapterID}/tags/{tagID}", tagH.UnlinkFromChapter)

		r.Get("/novels/{novelID}/characters", characterH.List)
		r.Post("/novels/{novelID}/characters", characterH.Create)
		r.Get("/novels/{novelID}/characters/{characterID}", characterH.GetByID)
		r.Patch("/novels/{novelID}/characters/{characterID}", characterH.Update)
		r.Delete("/novels/{novelID}/characters/{characterID}", characterH.Delete)

		r.Get("/novels/{novelID}/events", eventH.List)
		r.Post("/novels/{novelID}/events", eventH.Create)
		r.Patch("/novels/{novelID}/events/{eventID}", eventH.Update)
		r.Delete("/novels/{novelID}/events/{eventID}", eventH.Delete)
		r.Post("/novels/{novelID}/events/{eventID}/characters", eventH.LinkCharacter)
		r.Delete("/novels/{novelID}/events/{eventID}/characters/{characterID}", eventH.UnlinkCharacter)

		r.Get("/novels/{novelID}/tags", tagH.List)
		r.Post("/novels/{novelID}/tags", tagH.Create)
		r.Delete("/novels/{novelID}/tags/{tagID}", tagH.Delete)

		r.Get("/novels/{novelID}/search", searchH.Search)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s (env=%s)", addr, cfg.Env)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func corsMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	allowAll := false
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		if trimmed == "*" {
			allowAll = true
		}
		allowed[trimmed] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin != "" {
				if allowAll {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
				}
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func connectDB(dsn string) *pgxpool.Pool {
	if dsn == "" {
		log.Println("warn: DATABASE_URL not set, skipping database connection")
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Printf("warn: failed to create database pool: %v", err)
		return nil
	}
	if err := pool.Ping(ctx); err != nil {
		log.Printf("warn: database ping failed: %v", err)
		pool.Close()
		return nil
	}
	log.Println("database connected")
	return pool
}
```

- [ ] **Step 2: Build — must be clean**

```bash
cd apps/api && go build ./...
```

Expected: no output (clean compile).

- [ ] **Step 3: Run all tests**

```bash
cd apps/api && go test ./...
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/cmd/server/main.go
git commit -m "feat(server): wire volume layer, update routes to Novel→Volume→Chapter hierarchy"
```

---

### Task 13: Update docs

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `README.md`

- [ ] **Step 1: Update `docs/CONTEXT.md`**

Update the **Status** table (bottom of file):
```markdown
| Current phase  | Phase 4 — Search + Tags           |
| Last completed | Phase 4 partial + Volume layer    |
| Working on     | —                                 |
| Blocked by     | —                                 |
```

Update the **Folder Structure** — in the `app/` listing, rename `novels/[id]/chapters/` to note that chapters are now under volumes:
```
      novels/
        page.tsx
        AddNovelForm.tsx
        [id]/
          page.tsx
          chapters/[chapterId]/   ← will move to volumes/[volumeId]/chapters/[chapterId]/ in web phase
```

Update the **API Routes** section — replace the chapters block and add volumes:
```
GET    /api/v1/novels/:id/volumes
POST   /api/v1/novels/:id/volumes
GET    /api/v1/novels/:id/volumes/:volumeId
PATCH  /api/v1/novels/:id/volumes/:volumeId
DELETE /api/v1/novels/:id/volumes/:volumeId

GET    /api/v1/novels/:id/volumes/:volumeId/chapters
POST   /api/v1/novels/:id/volumes/:volumeId/chapters
GET    /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId
PATCH  /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId

GET    /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters
POST   /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/characters/:characterId

POST   /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/tags
DELETE /api/v1/novels/:id/volumes/:volumeId/chapters/:chapterId/tags/:tagId
```

Update the **Migrations** table — add rows:
```markdown
| 000010 | create_volumes | volumes table (novel-scoped, UNIQUE(novel_id, number)) |
| 000011 | add_volume_to_chapters | chapters get volume_id FK; novel_id dropped; data migration creates Volume 1 per novel |
```

Update the **Key Decisions** section — add:
```markdown
- **Novel→Volume→Chapter hierarchy** — chapters belong to volumes; novel ownership derived via JOIN (ADR-005)
- **Chapter number is novel-scoped** — enforced in usecase via `NumberExistsInNovel`; DB constraint is per-volume for performance
- **Data migration creates "Volume 1"** — all pre-existing chapters land in a generated Volume 1 per novel
```

- [ ] **Step 2: Update `README.md`**

In the **Features** section, update and add:
```markdown
- **Volumes** — group chapters into arcs or parts within a novel
- **Chapters** — summaries with `[[Name]]` auto-linking to characters; scoped under volumes
```

- [ ] **Step 3: Commit**

```bash
git add docs/CONTEXT.md README.md
git commit -m "docs: update CONTEXT.md and README for Novel→Volume→Chapter hierarchy"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|-----------------|-----------|
| `volumes` table | Tasks 1, 3, 5, 8, 10 |
| Chapters → volume_id (not novel_id) | Tasks 2, 4, 6, 9, 11 |
| Data migration: Volume 1 per novel | Task 2 (000011 up) |
| Volume ordering/indexing (number, UNIQUE) | Task 1, Task 8 |
| Novel ownership preserved | volume_repo.GetByID checks novel_id; chapter handler `resolveVolume` |
| Novel-scoped chapter number uniqueness | Task 6 (`NumberExistsInNovel`), Task 9 (usecase check) |
| Rollback-safe migration | Task 2 (000011 down restores novel_id via volumes JOIN) |
| Updated repositories | Tasks 5, 6, 7 |
| Updated usecases | Tasks 8, 9 |
| Updated handlers | Tasks 10, 11 |
| Updated routes (deep nested) | Task 12 |
| Search still works | Task 7 (JOIN volumes in SearchChapters) |
| Docs updated | Task 13 |
| No commit at end | ✓ (last step is docs commit) |

### Type consistency

- `VolumeRepository` defined Task 3, implemented Task 5, used Tasks 8/10/12 ✓
- `Chapter.VolumeID` defined Task 4, used Tasks 6/9/11 ✓
- `ChapterUsecase.Create(ctx, novelID, ch)` defined Task 9, called Task 11 ✓
- `ChapterUsecase.Update(ctx, novelID, ch)` defined Task 9, called Task 11 ✓
- `NewChapterHandler(uc, volumeUC)` defined Task 11, wired Task 12 ✓
- `NumberExistsInNovel(ctx, novelID, number, excludeID)` interface Task 4, impl Task 6, called Task 9 ✓
- `resolveVolume(ctx, w, novelID, volumeID)` defined and used within Task 11 ✓

### Placeholder scan

None found. All steps contain concrete code.
