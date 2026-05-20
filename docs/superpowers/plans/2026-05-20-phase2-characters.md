# Phase 2: Characters + Cross-link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add characters CRUD under novels, many-to-many chapter↔character linking, `[[Name]]` mention auto-linking, and character profile pages.

**Architecture:** Follows existing domain→repository→usecase→handler layering. `ChapterUsecase` gains a `CharacterRepository` dependency for auto-link on summary save. Frontend uses server components for pages, client components for forms and interactive editors. JSON tags are added to all domain structs to align Go output with TypeScript snake_case expectations.

**Tech Stack:** Go 1.25, pgx/v5/pgxpool, chi v5, golang-migrate; Next.js 16 App Router, React 19, Tailwind v4, TypeScript.

---

## File Map

**New (API)**
- `apps/api/migrations/000003_create_characters.up.sql`
- `apps/api/migrations/000003_create_characters.down.sql`
- `apps/api/migrations/000004_create_chapter_characters.up.sql`
- `apps/api/migrations/000004_create_chapter_characters.down.sql`
- `apps/api/internal/domain/character.go`
- `apps/api/internal/util/mention.go`
- `apps/api/internal/util/mention_test.go`
- `apps/api/internal/repository/character_repo.go`
- `apps/api/internal/usecase/character_usecase.go`
- `apps/api/internal/handler/character_handler.go`

**Modified (API)**
- `apps/api/internal/domain/novel.go` — add json tags
- `apps/api/internal/domain/chapter.go` — add json tags, add `ChapterWithCharacters`
- `apps/api/internal/usecase/chapter_usecase.go` — add `charRepo` dep, `GetByIDWithCharacters`, auto-link in `Update`
- `apps/api/internal/handler/chapter_handler.go` — `GetByID` returns `ChapterWithCharacters`
- `apps/api/cmd/server/main.go` — wire character deps, add routes

**New (Web)**
- `apps/web/app/novels/[id]/characters/page.tsx`
- `apps/web/app/novels/[id]/characters/AddCharacterForm.tsx`
- `apps/web/app/novels/[id]/characters/[characterId]/page.tsx`
- `apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`
- `apps/web/app/novels/[id]/chapters/[chapterId]/SummaryRenderer.tsx`
- `apps/web/app/novels/[id]/chapters/[chapterId]/LinkedCharactersPanel.tsx`

**Modified (Web)**
- `apps/web/app/types.ts` — add `Character`, `ChapterSummary`, `ChapterWithCharacters`
- `apps/web/app/novels/[id]/page.tsx` — add Characters link + count
- `apps/web/app/novels/[id]/chapters/[chapterId]/page.tsx` — fetch enriched chapter, pass characters
- `apps/web/app/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx` — view/edit toggle, autocomplete, `LinkedCharactersPanel`

---

## Task 1: Fix JSON tags on existing domain structs

**Files:**
- Modify: `apps/api/internal/domain/novel.go`
- Modify: `apps/api/internal/domain/chapter.go`

Without json tags, `encoding/json` serializes `ID` as `"ID"` but the TypeScript types expect `"id"`. This breaks every API response. Fix both files before adding new code.

- [ ] **Step 1: Rewrite `apps/api/internal/domain/novel.go`**

```go
package domain

import (
	"context"
	"time"
)

type Novel struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Author      string    `json:"author"`
	Status      string    `json:"status"`
	Description string    `json:"description"`
	CoverURL    string    `json:"cover_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type NovelRepository interface {
	List(ctx context.Context) ([]Novel, error)
	Create(ctx context.Context, n *Novel) error
	GetByID(ctx context.Context, id string) (*Novel, error)
	Update(ctx context.Context, n *Novel) error
	Delete(ctx context.Context, id string) error
}
```

- [ ] **Step 2: Rewrite `apps/api/internal/domain/chapter.go`**

```go
package domain

import (
	"context"
	"time"
)

type Chapter struct {
	ID        string     `json:"id"`
	NovelID   string     `json:"novel_id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Summary   string     `json:"summary"`
	ReadAt    *time.Time `json:"read_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type ChapterWithCharacters struct {
	Chapter
	Characters []Character `json:"characters"`
}

type ChapterRepository interface {
	List(ctx context.Context, novelID string) ([]Chapter, error)
	Create(ctx context.Context, ch *Chapter) error
	GetByID(ctx context.Context, novelID, id string) (*Chapter, error)
	Update(ctx context.Context, ch *Chapter) error
	Delete(ctx context.Context, novelID, id string) error
}
```

- [ ] **Step 3: Build to verify no compile errors**

```bash
cd apps/api && go build ./...
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add apps/api/internal/domain/novel.go apps/api/internal/domain/chapter.go
git commit -m "fix: add json tags to domain structs for correct API serialization"
```

---

## Task 2: DB migration — characters table

**Files:**
- Create: `apps/api/migrations/000003_create_characters.up.sql`
- Create: `apps/api/migrations/000003_create_characters.down.sql`

- [ ] **Step 1: Write `000003_create_characters.up.sql`**

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

- [ ] **Step 2: Write `000003_create_characters.down.sql`**

```sql
DROP INDEX IF EXISTS idx_characters_novel_id;
DROP TABLE IF EXISTS characters;
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/000003_create_characters.up.sql apps/api/migrations/000003_create_characters.down.sql
git commit -m "feat: migration 000003 create characters table"
```

---

## Task 3: DB migration — chapter_characters table

**Files:**
- Create: `apps/api/migrations/000004_create_chapter_characters.up.sql`
- Create: `apps/api/migrations/000004_create_chapter_characters.down.sql`

- [ ] **Step 1: Write `000004_create_chapter_characters.up.sql`**

```sql
CREATE TABLE chapter_characters (
  chapter_id   UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, character_id)
);

CREATE INDEX idx_chapter_characters_character_id ON chapter_characters(character_id);
```

- [ ] **Step 2: Write `000004_create_chapter_characters.down.sql`**

```sql
DROP INDEX IF EXISTS idx_chapter_characters_character_id;
DROP TABLE IF EXISTS chapter_characters;
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/000004_create_chapter_characters.up.sql apps/api/migrations/000004_create_chapter_characters.down.sql
git commit -m "feat: migration 000004 create chapter_characters join table"
```

---

## Task 4: Run migrations

- [ ] **Step 1: Ensure Docker is running**

```bash
docker compose ps
```

Expected: postgres container shows `running`.

- [ ] **Step 2: Apply migrations**

```bash
make migrate-up
```

Expected: lines like `000003/u create_characters`, `000004/u create_chapter_characters`.

- [ ] **Step 3: Verify tables exist**

```bash
make db
```

In psql, run:

```sql
\dt
```

Expected: `characters` and `chapter_characters` appear in the list. Type `\q` to exit.

---

## Task 5: domain/character.go

**Files:**
- Create: `apps/api/internal/domain/character.go`

- [ ] **Step 1: Write the file**

```go
package domain

import (
	"context"
	"time"
)

type Character struct {
	ID                       string         `json:"id"`
	NovelID                  string         `json:"novel_id"`
	Name                     string         `json:"name"`
	Aliases                  []string       `json:"aliases"`
	Role                     string         `json:"role"`
	Description              string         `json:"description"`
	FirstAppearanceChapterID *string        `json:"first_appearance_chapter_id"`
	ChapterCount             int            `json:"chapter_count"`
	Chapters                 []ChapterSummary `json:"chapters,omitempty"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
}

type ChapterSummary struct {
	ID     string     `json:"id"`
	Number int        `json:"number"`
	Title  string     `json:"title"`
	ReadAt *time.Time `json:"read_at"`
}

type CharacterRepository interface {
	List(ctx context.Context, novelID string) ([]Character, error)
	Create(ctx context.Context, c *Character) error
	GetByID(ctx context.Context, novelID, id string) (*Character, error)
	Update(ctx context.Context, c *Character) error
	Delete(ctx context.Context, novelID, id string) error
	ListByChapter(ctx context.Context, chapterID string) ([]Character, error)
	LinkToChapter(ctx context.Context, chapterID, characterID string) error
	UnlinkFromChapter(ctx context.Context, chapterID, characterID string) error
	LinkMentions(ctx context.Context, chapterID, novelID string, names []string) error
}
```

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/domain/character.go
git commit -m "feat: Character domain struct and repository interface"
```

---

## Task 6: util/mention.go — TDD

**Files:**
- Create: `apps/api/internal/util/mention_test.go`
- Create: `apps/api/internal/util/mention.go`

- [ ] **Step 1: Write the failing test first**

```go
// apps/api/internal/util/mention_test.go
package util

import (
	"reflect"
	"testing"
)

func TestExtractMentions(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{"empty string", "", nil},
		{"no mentions", "plain text with no brackets", nil},
		{"one mention", "saw [[Alice]] today", []string{"Alice"}},
		{"two mentions", "[[Alice]] meets [[Bob]]", []string{"Alice", "Bob"}},
		{"duplicate deduped", "[[Alice]] and [[Alice]] again", []string{"Alice"}},
		{"adjacent", "[[Alice]][[Bob]]", []string{"Alice", "Bob"}},
		{"whitespace in name", "[[Crimson Lord]]", []string{"Crimson Lord"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ExtractMentions(tc.input)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("ExtractMentions(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && go test ./internal/util/...
```

Expected: `cannot find package` or `undefined: ExtractMentions`.

- [ ] **Step 3: Write `mention.go`**

```go
// apps/api/internal/util/mention.go
package util

import "regexp"

var mentionRe = regexp.MustCompile(`\[\[([^\]]+)\]\]`)

func ExtractMentions(text string) []string {
	matches := mentionRe.FindAllStringSubmatch(text, -1)
	seen := make(map[string]struct{})
	var result []string
	for _, m := range matches {
		name := m[1]
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			result = append(result, name)
		}
	}
	return result
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/api && go test ./internal/util/... -v
```

Expected: all 7 subtests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/internal/util/mention.go apps/api/internal/util/mention_test.go
git commit -m "feat: ExtractMentions util for [[Name]] parsing (TDD)"
```

---

## Task 7: repository/character_repo.go

**Files:**
- Create: `apps/api/internal/repository/character_repo.go`

- [ ] **Step 1: Write the file**

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxCharacterRepo struct {
	pool *pgxpool.Pool
}

func NewCharacterRepository(pool *pgxpool.Pool) domain.CharacterRepository {
	return &pgxCharacterRepo{pool: pool}
}

func (r *pgxCharacterRepo) List(ctx context.Context, novelID string) ([]domain.Character, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.novel_id, c.name, c.aliases, c.role, c.description,
		       c.first_appearance_chapter_id, c.created_at, c.updated_at,
		       COUNT(cc.chapter_id) AS chapter_count
		FROM characters c
		LEFT JOIN chapter_characters cc ON cc.character_id = c.id
		WHERE c.novel_id = $1
		GROUP BY c.id
		ORDER BY c.role, c.name
	`, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chars []domain.Character
	for rows.Next() {
		var c domain.Character
		if err := rows.Scan(
			&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
			&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt, &c.ChapterCount,
		); err != nil {
			return nil, err
		}
		if c.Aliases == nil {
			c.Aliases = []string{}
		}
		chars = append(chars, c)
	}
	return chars, rows.Err()
}

func (r *pgxCharacterRepo) Create(ctx context.Context, c *domain.Character) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO characters
		  (novel_id, name, aliases, role, description, first_appearance_chapter_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, c.NovelID, c.Name, c.Aliases, c.Role, c.Description,
		c.FirstAppearanceChapterID, c.CreatedAt, c.UpdatedAt,
	).Scan(&c.ID)
}

func (r *pgxCharacterRepo) GetByID(ctx context.Context, novelID, id string) (*domain.Character, error) {
	var c domain.Character
	err := r.pool.QueryRow(ctx, `
		SELECT id, novel_id, name, aliases, role, description,
		       first_appearance_chapter_id, created_at, updated_at
		FROM characters WHERE id = $1 AND novel_id = $2
	`, id, novelID).Scan(
		&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
		&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if c.Aliases == nil {
		c.Aliases = []string{}
	}

	rows, err := r.pool.Query(ctx, `
		SELECT ch.id, ch.number, ch.title, ch.read_at
		FROM chapters ch
		JOIN chapter_characters cc ON cc.chapter_id = ch.id
		WHERE cc.character_id = $1
		ORDER BY ch.number ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	c.Chapters = []domain.ChapterSummary{}
	for rows.Next() {
		var s domain.ChapterSummary
		if err := rows.Scan(&s.ID, &s.Number, &s.Title, &s.ReadAt); err != nil {
			return nil, err
		}
		c.Chapters = append(c.Chapters, s)
	}
	return &c, rows.Err()
}

func (r *pgxCharacterRepo) Update(ctx context.Context, c *domain.Character) error {
	err := r.pool.QueryRow(ctx, `
		UPDATE characters
		SET name = $3, aliases = $4, role = $5, description = $6,
		    first_appearance_chapter_id = $7, updated_at = NOW()
		WHERE id = $1 AND novel_id = $2
		RETURNING updated_at
	`, c.ID, c.NovelID, c.Name, c.Aliases, c.Role, c.Description,
		c.FirstAppearanceChapterID,
	).Scan(&c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxCharacterRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM characters WHERE id = $1 AND novel_id = $2`, id, novelID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxCharacterRepo) ListByChapter(ctx context.Context, chapterID string) ([]domain.Character, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.novel_id, c.name, c.aliases, c.role, c.description,
		       c.first_appearance_chapter_id, c.created_at, c.updated_at
		FROM characters c
		JOIN chapter_characters cc ON cc.character_id = c.id
		WHERE cc.chapter_id = $1
		ORDER BY c.name
	`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chars []domain.Character
	for rows.Next() {
		var c domain.Character
		if err := rows.Scan(
			&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
			&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if c.Aliases == nil {
			c.Aliases = []string{}
		}
		chars = append(chars, c)
	}
	return chars, rows.Err()
}

func (r *pgxCharacterRepo) LinkToChapter(ctx context.Context, chapterID, characterID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO chapter_characters (chapter_id, character_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, chapterID, characterID)
	return err
}

func (r *pgxCharacterRepo) UnlinkFromChapter(ctx context.Context, chapterID, characterID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM chapter_characters WHERE chapter_id = $1 AND character_id = $2`,
		chapterID, characterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxCharacterRepo) LinkMentions(ctx context.Context, chapterID, novelID string, names []string) error {
	if len(names) == 0 {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO chapter_characters (chapter_id, character_id)
		SELECT $1, id FROM characters WHERE novel_id = $2 AND name = ANY($3)
		ON CONFLICT DO NOTHING
	`, chapterID, novelID, names)
	return err
}
```

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/repository/character_repo.go
git commit -m "feat: character repository (pgx)"
```

---

## Task 8: usecase/character_usecase.go

**Files:**
- Create: `apps/api/internal/usecase/character_usecase.go`

- [ ] **Step 1: Write the file**

```go
package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type CharacterUsecase struct {
	repo domain.CharacterRepository
}

func NewCharacterUsecase(repo domain.CharacterRepository) *CharacterUsecase {
	return &CharacterUsecase{repo: repo}
}

func (u *CharacterUsecase) List(ctx context.Context, novelID string) ([]domain.Character, error) {
	return u.repo.List(ctx, novelID)
}

func (u *CharacterUsecase) Create(ctx context.Context, c *domain.Character) error {
	if c.NovelID == "" {
		return errors.New("novel_id is required")
	}
	if c.Name == "" {
		return errors.New("name is required")
	}
	if c.Role == "" {
		c.Role = "minor"
	}
	if c.Aliases == nil {
		c.Aliases = []string{}
	}
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	return u.repo.Create(ctx, c)
}

func (u *CharacterUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Character, error) {
	return u.repo.GetByID(ctx, novelID, id)
}

func (u *CharacterUsecase) Update(ctx context.Context, c *domain.Character) error {
	if c.Name == "" {
		return errors.New("name is required")
	}
	if c.Role == "" {
		return errors.New("role is required")
	}
	return u.repo.Update(ctx, c)
}

func (u *CharacterUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}

func (u *CharacterUsecase) ListByChapter(ctx context.Context, chapterID string) ([]domain.Character, error) {
	return u.repo.ListByChapter(ctx, chapterID)
}

func (u *CharacterUsecase) LinkToChapter(ctx context.Context, chapterID, characterID string) error {
	return u.repo.LinkToChapter(ctx, chapterID, characterID)
}

func (u *CharacterUsecase) UnlinkFromChapter(ctx context.Context, chapterID, characterID string) error {
	return u.repo.UnlinkFromChapter(ctx, chapterID, characterID)
}
```

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/usecase/character_usecase.go
git commit -m "feat: character usecase"
```

---

## Task 9: Update usecase/chapter_usecase.go

**Files:**
- Modify: `apps/api/internal/usecase/chapter_usecase.go`

Add `charRepo` dependency, `GetByIDWithCharacters` method, and auto-link on summary save.

- [ ] **Step 1: Rewrite the file**

```go
package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/util"
)

type ChapterUsecase struct {
	repo     domain.ChapterRepository
	charRepo domain.CharacterRepository
}

func NewChapterUsecase(repo domain.ChapterRepository, charRepo domain.CharacterRepository) *ChapterUsecase {
	return &ChapterUsecase{repo: repo, charRepo: charRepo}
}

func (u *ChapterUsecase) List(ctx context.Context, novelID string) ([]domain.Chapter, error) {
	return u.repo.List(ctx, novelID)
}

func (u *ChapterUsecase) Create(ctx context.Context, ch *domain.Chapter) error {
	if ch.NovelID == "" {
		return errors.New("novel_id is required")
	}
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	now := time.Now()
	ch.CreatedAt = now
	ch.UpdatedAt = now
	return u.repo.Create(ctx, ch)
}

func (u *ChapterUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Chapter, error) {
	return u.repo.GetByID(ctx, novelID, id)
}

func (u *ChapterUsecase) GetByIDWithCharacters(ctx context.Context, novelID, id string) (*domain.ChapterWithCharacters, error) {
	ch, err := u.repo.GetByID(ctx, novelID, id)
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
	return &domain.ChapterWithCharacters{Chapter: *ch, Characters: chars}, nil
}

func (u *ChapterUsecase) Update(ctx context.Context, ch *domain.Chapter) error {
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	if err := u.repo.Update(ctx, ch); err != nil {
		return err
	}
	if ch.Summary != "" {
		names := util.ExtractMentions(ch.Summary)
		if len(names) > 0 {
			_ = u.charRepo.LinkMentions(ctx, ch.ID, ch.NovelID, names)
		}
	}
	return nil
}

func (u *ChapterUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}
```

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/usecase/chapter_usecase.go
git commit -m "feat: ChapterUsecase — charRepo dep, GetByIDWithCharacters, auto-link on update"
```

---

## Task 10: handler/character_handler.go

**Files:**
- Create: `apps/api/internal/handler/character_handler.go`

- [ ] **Step 1: Write the file**

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

type CharacterHandler struct {
	uc *usecase.CharacterUsecase
}

func NewCharacterHandler(uc *usecase.CharacterUsecase) *CharacterHandler {
	return &CharacterHandler{uc: uc}
}

type characterCreateRequest struct {
	Name        string   `json:"name"`
	Role        string   `json:"role"`
	Description string   `json:"description"`
	Aliases     []string `json:"aliases"`
}

type characterUpdateRequest struct {
	Name        *string   `json:"name"`
	Role        *string   `json:"role"`
	Description *string   `json:"description"`
	Aliases     *[]string `json:"aliases"`
}

type characterLinkRequest struct {
	CharacterID string `json:"character_id"`
}

func (h *CharacterHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chars, err := h.uc.List(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chars})
}

func (h *CharacterHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req characterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := &domain.Character{
		NovelID:     novelID,
		Name:        req.Name,
		Role:        req.Role,
		Description: req.Description,
		Aliases:     req.Aliases,
	}
	if err := h.uc.Create(r.Context(), c); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": c})
}

func (h *CharacterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")
	c, err := h.uc.GetByID(r.Context(), novelID, characterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *CharacterHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")

	c, err := h.uc.GetByID(r.Context(), novelID, characterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req characterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		c.Name = *req.Name
	}
	if req.Role != nil {
		c.Role = *req.Role
	}
	if req.Description != nil {
		c.Description = *req.Description
	}
	if req.Aliases != nil {
		c.Aliases = *req.Aliases
	}

	if err := h.uc.Update(r.Context(), c); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *CharacterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")
	if err := h.uc.Delete(r.Context(), novelID, characterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CharacterHandler) ListByChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	chars, err := h.uc.ListByChapter(r.Context(), chapterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chars})
}

func (h *CharacterHandler) LinkToChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	var req characterLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CharacterID == "" {
		writeError(w, http.StatusBadRequest, "character_id is required")
		return
	}
	if err := h.uc.LinkToChapter(r.Context(), chapterID, req.CharacterID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CharacterHandler) UnlinkFromChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	characterID := chi.URLParam(r, "characterID")
	if err := h.uc.UnlinkFromChapter(r.Context(), chapterID, characterID); err != nil {
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

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/handler/character_handler.go
git commit -m "feat: character handler (CRUD + chapter link/unlink endpoints)"
```

---

## Task 11: Update chapter_handler.go — GetByID returns ChapterWithCharacters

**Files:**
- Modify: `apps/api/internal/handler/chapter_handler.go`

Only `GetByID` changes. Replace its body to call `GetByIDWithCharacters`.

- [ ] **Step 1: Replace `GetByID` method body**

Find this method in `apps/api/internal/handler/chapter_handler.go`:

```go
func (h *ChapterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapterID := chi.URLParam(r, "chapterID")
	ch, err := h.uc.GetByID(r.Context(), novelID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}
```

Replace with:

```go
func (h *ChapterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapterID := chi.URLParam(r, "chapterID")
	ch, err := h.uc.GetByIDWithCharacters(r.Context(), novelID, chapterID)
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
```

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/internal/handler/chapter_handler.go
git commit -m "feat: chapter GetByID now returns characters alongside chapter data"
```

---

## Task 12: Wire everything in main.go + add routes

**Files:**
- Modify: `apps/api/cmd/server/main.go`

- [ ] **Step 1: Rewrite `main.go`**

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
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

	chapterRepo := repository.NewChapterRepository(pool)
	chapterUC := usecase.NewChapterUsecase(chapterRepo, characterRepo)
	chapterH := handler.NewChapterHandler(chapterUC)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", handler.Health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/novels", novelH.List)
		r.Post("/novels", novelH.Create)
		r.Get("/novels/{id}", novelH.GetByID)
		r.Patch("/novels/{id}", novelH.Update)
		r.Delete("/novels/{id}", novelH.Delete)

		r.Get("/novels/{novelID}/chapters", chapterH.List)
		r.Post("/novels/{novelID}/chapters", chapterH.Create)
		r.Get("/novels/{novelID}/chapters/{chapterID}", chapterH.GetByID)
		r.Patch("/novels/{novelID}/chapters/{chapterID}", chapterH.Update)
		r.Delete("/novels/{novelID}/chapters/{chapterID}", chapterH.Delete)

		r.Get("/novels/{novelID}/characters", characterH.List)
		r.Post("/novels/{novelID}/characters", characterH.Create)
		r.Get("/novels/{novelID}/characters/{characterID}", characterH.GetByID)
		r.Patch("/novels/{novelID}/characters/{characterID}", characterH.Update)
		r.Delete("/novels/{novelID}/characters/{characterID}", characterH.Delete)

		r.Get("/novels/{novelID}/chapters/{chapterID}/characters", characterH.ListByChapter)
		r.Post("/novels/{novelID}/chapters/{chapterID}/characters", characterH.LinkToChapter)
		r.Delete("/novels/{novelID}/chapters/{chapterID}/characters/{characterID}", characterH.UnlinkFromChapter)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s (env=%s)", addr, cfg.Env)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
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

- [ ] **Step 2: Build**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Run tests**

```bash
cd apps/api && go test ./...
```

Expected: all pass (util/mention tests + any others).

- [ ] **Step 4: Commit**

```bash
git add apps/api/cmd/server/main.go
git commit -m "feat: wire character deps and register character routes"
```

---

## Task 13: Smoke-test the API

Start the API and verify the new endpoints respond correctly.

- [ ] **Step 1: Start infrastructure + API**

```bash
make dev
```

Wait for "server listening on :8080".

- [ ] **Step 2: Create a test character**

First get a novel ID (use one from Phase 1):

```bash
curl -s http://localhost:8080/api/v1/novels | jq '.data[0].id'
```

Copy the ID (call it `NOVEL_ID`). Then:

```bash
curl -s -X POST http://localhost:8080/api/v1/novels/NOVEL_ID/characters \
  -H "Content-Type: application/json" \
  -d '{"name":"Elara","role":"protagonist","description":"Main hero"}' | jq .
```

Expected: `{"data":{"id":"...","name":"Elara","role":"protagonist",...}}`

- [ ] **Step 3: List characters**

```bash
curl -s http://localhost:8080/api/v1/novels/NOVEL_ID/characters | jq .
```

Expected: `{"data":[{"id":"...","name":"Elara","chapter_count":0,...}]}`

- [ ] **Step 4: Verify chapter GET includes characters array**

```bash
curl -s http://localhost:8080/api/v1/novels/NOVEL_ID/chapters | jq '.data[0].id'
```

Copy the chapter ID (call it `CHAPTER_ID`). Then:

```bash
curl -s http://localhost:8080/api/v1/novels/NOVEL_ID/chapters/CHAPTER_ID | jq '.data.characters'
```

Expected: `[]`

---

## Task 14: Update apps/web/app/types.ts

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
  role: 'protagonist' | 'supporting' | 'antagonist' | 'minor'
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
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/types.ts
git commit -m "feat: add Character, ChapterSummary, ChapterWithCharacters types"
```

---

## Task 15: SummaryRenderer.tsx

**Files:**
- Create: `apps/web/app/novels/[id]/chapters/[chapterId]/SummaryRenderer.tsx`

Parses `[[Name]]` in summary text and renders matched names as links to character profiles. Unmatched names render as underlined plain text.

- [ ] **Step 1: Write the file**

```tsx
import Link from 'next/link'
import type { Character } from '../../../../types'

interface Props {
  summary: string
  characters: Character[]
  novelId: string
}

export default function SummaryRenderer({ summary, characters, novelId }: Props) {
  if (!summary) {
    return <p className="text-sm text-gray-500 italic">No summary yet.</p>
  }

  const nameToChar = new Map(characters.map((c) => [c.name, c]))
  const parts = summary.split(/(\[\[[^\]]+\]\])/g)

  return (
    <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/^\[\[([^\]]+)\]\]$/)
        if (!match) return part
        const name = match[1]
        const char = nameToChar.get(name)
        if (char) {
          return (
            <Link
              key={i}
              href={`/novels/${novelId}/characters/${char.id}`}
              className="underline text-blue-400 hover:text-blue-300"
            >
              {name}
            </Link>
          )
        }
        return (
          <span key={i} className="underline text-gray-400">
            {name}
          </span>
        )
      })}
    </p>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/chapters/[chapterId]/SummaryRenderer.tsx"
git commit -m "feat: SummaryRenderer — render [[Name]] mentions as character links"
```

---

## Task 16: LinkedCharactersPanel.tsx

**Files:**
- Create: `apps/web/app/novels/[id]/chapters/[chapterId]/LinkedCharactersPanel.tsx`

Shows characters linked to this chapter. Supports manual link via dropdown and unlink via × button. Calls `router.refresh()` after each mutation to re-fetch server component data.

- [ ] **Step 1: Write the file**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Character } from '../../../../types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface Props {
  novelId: string
  chapterId: string
  linkedCharacters: Character[]
  allCharacters: Character[]
}

export default function LinkedCharactersPanel({
  novelId,
  chapterId,
  linkedCharacters,
  allCharacters,
}: Props) {
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const linkedIds = new Set(linkedCharacters.map((c) => c.id))
  const unlinked = allCharacters.filter(
    (c) => !linkedIds.has(c.id) && c.name.toLowerCase().includes(query.toLowerCase()),
  )

  async function link(characterId: string) {
    setBusy(true)
    try {
      await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapterId}/characters`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: characterId }),
        },
      )
      setShowDropdown(false)
      setQuery('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function unlink(characterId: string) {
    setBusy(true)
    try {
      await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapterId}/characters/${characterId}`,
        { method: 'DELETE' },
      )
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Characters in this chapter</h3>
        <button
          onClick={() => setShowDropdown((s) => !s)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Link character
        </button>
      </div>

      {showDropdown && (
        <div className="mb-3 rounded-md border border-gray-700 bg-gray-900 p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters…"
            className="mb-2 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
            autoFocus
          />
          {unlinked.length === 0 ? (
            <p className="text-xs text-gray-500">No characters to link.</p>
          ) : (
            <ul>
              {unlinked.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => link(c.id)}
                    disabled={busy}
                    className="w-full rounded px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                  >
                    {c.name}
                    <span className="ml-1 text-gray-500">({c.role})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {linkedCharacters.length === 0 ? (
        <p className="text-xs text-gray-600">No characters linked yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linkedCharacters.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-200"
            >
              {c.name}
              <button
                onClick={() => unlink(c.id)}
                disabled={busy}
                className="ml-0.5 text-gray-500 hover:text-red-400 disabled:opacity-50"
                aria-label={`Unlink ${c.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/chapters/[chapterId]/LinkedCharactersPanel.tsx"
git commit -m "feat: LinkedCharactersPanel — link/unlink characters on chapter"
```

---

## Task 17: Update ChapterEditor.tsx — view/edit toggle + autocomplete + panel

**Files:**
- Modify: `apps/web/app/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx`

Adds: view mode with `SummaryRenderer`, edit mode with `[[Name]]` autocomplete dropdown, and the `LinkedCharactersPanel` below summary.

- [ ] **Step 1: Rewrite the file**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ChapterWithCharacters, Character } from '../../../../types'
import SummaryRenderer from './SummaryRenderer'
import LinkedCharactersPanel from './LinkedCharactersPanel'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface Autocomplete {
  show: boolean
  query: string
  index: number
}

export default function ChapterEditor({
  chapter,
  novelId,
}: {
  chapter: ChapterWithCharacters
  novelId: string
}) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [editMode, setEditMode] = useState(false)
  const [summary, setSummary] = useState(chapter.summary ?? '')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarySaving, setSummarySaving] = useState(false)

  const [readAt, setReadAt] = useState(chapter.read_at ?? '')
  const [readAtError, setReadAtError] = useState<string | null>(null)
  const [readAtSaving, setReadAtSaving] = useState(false)

  const [allCharacters, setAllCharacters] = useState<Character[]>([])
  const [autocomplete, setAutocomplete] = useState<Autocomplete>({
    show: false,
    query: '',
    index: 0,
  })

  useEffect(() => {
    fetch(`${BASE}/api/v1/novels/${novelId}/characters`)
      .then((r) => r.json())
      .then((body) => setAllCharacters(body.data ?? []))
      .catch(() => {})
  }, [novelId])

  const filteredChars = allCharacters.filter((c) =>
    c.name.toLowerCase().includes(autocomplete.query.toLowerCase()),
  )

  function handleSummaryInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setSummary(val)
    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const match = before.match(/\[\[([^\]]*)$/)
    if (match) {
      setAutocomplete({ show: true, query: match[1], index: 0 })
    } else {
      setAutocomplete({ show: false, query: '', index: 0 })
    }
  }

  function handleSummaryKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!autocomplete.show || filteredChars.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAutocomplete((a) => ({ ...a, index: Math.min(a.index + 1, filteredChars.length - 1) }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAutocomplete((a) => ({ ...a, index: Math.max(a.index - 1, 0) }))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      insertMention(filteredChars[autocomplete.index].name)
    } else if (e.key === 'Escape') {
      setAutocomplete({ show: false, query: '', index: 0 })
    }
  }

  function insertMention(name: string) {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const before = summary.slice(0, pos)
    const after = summary.slice(pos)
    const match = before.match(/\[\[([^\]]*)$/)
    if (!match) return
    const start = before.length - match[0].length
    const newSummary = before.slice(0, start) + `[[${name}]]` + after
    setSummary(newSummary)
    setAutocomplete({ show: false, query: '', index: 0 })
    // Restore focus
    requestAnimationFrame(() => {
      const newPos = start + name.length + 4
      ta.setSelectionRange(newPos, newPos)
      ta.focus()
    })
  }

  async function saveSummary() {
    setSummaryError(null)
    setSummarySaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSummaryError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setEditMode(false)
      router.refresh()
    } catch {
      setSummaryError('Network error. Please try again.')
    } finally {
      setSummarySaving(false)
    }
  }

  async function saveReadAt() {
    setReadAtError(null)
    setReadAtSaving(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/chapters/${chapter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read_at: readAt }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setReadAtError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      router.refresh()
    } catch {
      setReadAtError('Network error. Please try again.')
    } finally {
      setReadAtSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Summary */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Summary</label>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Edit
            </button>
          )}
        </div>

        {editMode ? (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={summary}
              onChange={handleSummaryInput}
              onKeyDown={handleSummaryKeyDown}
              rows={6}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="Chapter summary — type [[Name]] to mention a character"
              autoFocus
            />
            {autocomplete.show && filteredChars.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-64 overflow-auto rounded-md border border-gray-700 bg-gray-900 shadow-lg">
                {filteredChars.map((c, i) => (
                  <li key={c.id}>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertMention(c.name)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm ${
                        i === autocomplete.index
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {c.name}
                      <span className="ml-1 text-xs opacity-60">({c.role})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {summaryError && <p className="mt-1 text-sm text-red-400">{summaryError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSummary(chapter.summary ?? '')
                  setEditMode(false)
                  setSummaryError(null)
                }}
                className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveSummary}
                disabled={summarySaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {summarySaving ? 'Saving…' : 'Save summary'}
              </button>
            </div>
          </div>
        ) : (
          <SummaryRenderer
            summary={chapter.summary ?? ''}
            characters={chapter.characters}
            novelId={novelId}
          />
        )}
      </div>

      {/* Linked characters */}
      <LinkedCharactersPanel
        novelId={novelId}
        chapterId={chapter.id}
        linkedCharacters={chapter.characters}
        allCharacters={allCharacters}
      />

      {/* Date read */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Date Read</label>
        <input
          type="date"
          value={readAt}
          onChange={(e) => setReadAt(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
        {readAtError && <p className="mt-1 text-sm text-red-400">{readAtError}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveReadAt}
            disabled={readAtSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {readAtSaving ? 'Saving…' : 'Save date'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/chapters/[chapterId]/ChapterEditor.tsx"
git commit -m "feat: ChapterEditor — view/edit toggle, [[Name]] autocomplete, linked characters panel"
```

---

## Task 18: Update chapter page.tsx — fetch ChapterWithCharacters

**Files:**
- Modify: `apps/web/app/novels/[id]/chapters/[chapterId]/page.tsx`

Change the fetch return type from `Chapter` to `ChapterWithCharacters` and update the prop type passed to `ChapterEditor`.

- [ ] **Step 1: Rewrite the file**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ChapterWithCharacters } from '../../../../types'
import ChapterEditor from './ChapterEditor'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getChapter(
  novelId: string,
  chapterId: string,
): Promise<ChapterWithCharacters | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/chapters/${chapterId}`,
      { cache: 'no-store' },
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return body.data as ChapterWithCharacters
  } catch {
    return null
  }
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params

  const chapter = await getChapter(id, chapterId)
  if (!chapter) notFound()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/novels/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← Back to novel
        </Link>

        <h1 className="mb-8 text-2xl font-bold tracking-tight">
          Ch. {chapter.number} — {chapter.title}
        </h1>

        <ChapterEditor chapter={chapter} novelId={id} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/chapters/[chapterId]/page.tsx"
git commit -m "feat: chapter page fetches ChapterWithCharacters"
```

---

## Task 19: AddCharacterForm.tsx

**Files:**
- Create: `apps/web/app/novels/[id]/characters/AddCharacterForm.tsx`

Client component. Inline form that expands when "Add character" is clicked.

- [ ] **Step 1: Write the file**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const ROLES = ['protagonist', 'supporting', 'antagonist', 'minor'] as const
type Role = (typeof ROLES)[number]

export default function AddCharacterForm({ novelId }: { novelId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('minor')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`${BASE}/api/v1/novels/${novelId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, description }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setName('')
      setRole('minor')
      setDescription('')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        + Add character
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-800 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          required
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="mb-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add character'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/characters/AddCharacterForm.tsx"
git commit -m "feat: AddCharacterForm client component"
```

---

## Task 20: Characters list page

**Files:**
- Create: `apps/web/app/novels/[id]/characters/page.tsx`

- [ ] **Step 1: Write the file**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Character } from '../../../types'
import AddCharacterForm from './AddCharacterForm'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const ROLE_BADGE: Record<Character['role'], string> = {
  protagonist: 'bg-blue-900 text-blue-300',
  supporting: 'bg-teal-900 text-teal-300',
  antagonist: 'bg-red-900 text-red-300',
  minor: 'bg-gray-800 text-gray-400',
}

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

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, characters] = await Promise.all([getNovel(id), getCharacters(id)])
  if (!novel) notFound()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/novels/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← {novel.title}
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Characters</h1>
          <AddCharacterForm novelId={id} />
        </div>

        {characters.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No characters yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {characters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/novels/${id}/characters/${c.id}`}
                  className="flex items-start justify-between px-4 py-3 hover:bg-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[c.role]}`}
                    >
                      {c.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {c.description && (
                      <span className="hidden max-w-xs truncate text-xs text-gray-500 sm:block">
                        {c.description}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{c.chapter_count} ch</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/characters/page.tsx"
git commit -m "feat: characters list page with role badges and chapter count"
```

---

## Task 21: CharacterDetail.tsx — inline edit client component

**Files:**
- Create: `apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`

- [ ] **Step 1: Write the file**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Character } from '../../../../types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const ROLES = ['protagonist', 'supporting', 'antagonist', 'minor'] as const
type Role = (typeof ROLES)[number]

const ROLE_BADGE: Record<Role, string> = {
  protagonist: 'bg-blue-900 text-blue-300',
  supporting: 'bg-teal-900 text-teal-300',
  antagonist: 'bg-red-900 text-red-300',
  minor: 'bg-gray-800 text-gray-400',
}

export default function CharacterDetail({
  character,
  novelId,
}: {
  character: Character
  novelId: string
}) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState(character.name)
  const [role, setRole] = useState<Role>(character.role)
  const [description, setDescription] = useState(character.description ?? '')
  const [aliasInput, setAliasInput] = useState(character.aliases.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)
    setSaving(true)
    const aliases = aliasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const res = await fetch(
        `${BASE}/api/v1/novels/${novelId}/characters/${character.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role, description, aliases }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed: ${res.status}`)
        return
      }
      setEditMode(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setName(character.name)
    setRole(character.role)
    setDescription(character.description ?? '')
    setAliasInput(character.aliases.join(', '))
    setError(null)
    setEditMode(false)
  }

  if (!editMode) {
    return (
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{character.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[character.role]}`}>
            {character.role}
          </span>
          <button
            onClick={() => setEditMode(true)}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300"
          >
            Edit
          </button>
        </div>
        {character.aliases.length > 0 && (
          <p className="mb-2 text-sm text-gray-500">
            Also known as: {character.aliases.join(', ')}
          </p>
        )}
        {character.description && (
          <p className="text-sm leading-relaxed text-gray-300">{character.description}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-800 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={aliasInput}
        onChange={(e) => setAliasInput(e.target.value)}
        placeholder="Aliases (comma-separated)"
        className="mb-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mb-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={cancel}
          className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/characters/[characterId]/CharacterDetail.tsx"
git commit -m "feat: CharacterDetail inline edit component"
```

---

## Task 22: Character profile page

**Files:**
- Create: `apps/web/app/novels/[id]/characters/[characterId]/page.tsx`

- [ ] **Step 1: Write the file**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Character } from '../../../../types'
import CharacterDetail from './CharacterDetail'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getCharacter(novelId: string, characterId: string): Promise<Character | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/novels/${novelId}/characters/${characterId}`,
      { cache: 'no-store' },
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return body.data as Character
  } catch {
    return null
  }
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}) {
  const { id, characterId } = await params

  const character = await getCharacter(id, characterId)
  if (!character) notFound()

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/novels/${id}/characters`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← All characters
        </Link>

        <CharacterDetail character={character} novelId={id} />

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-200">Appears in</h2>
          {!character.chapters || character.chapters.length === 0 ? (
            <p className="text-sm text-gray-600">No chapters linked yet.</p>
          ) : (
            <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
              {character.chapters.map((ch) => (
                <li key={ch.id}>
                  <Link
                    href={`/novels/${id}/chapters/${ch.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-900"
                  >
                    <span className="text-sm text-white">
                      Ch. {ch.number} — {ch.title}
                    </span>
                    {ch.read_at && (
                      <span className="text-xs text-gray-500">
                        {ch.read_at.slice(0, 10)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/characters/[characterId]/page.tsx"
git commit -m "feat: character profile page with chapter appearance list"
```

---

## Task 23: Update novel detail page — add Characters link

**Files:**
- Modify: `apps/web/app/novels/[id]/page.tsx`

Add a "Characters (N)" link in the novel header alongside the Chapters section.

- [ ] **Step 1: Add character count fetch function and update the page**

In `apps/web/app/novels/[id]/page.tsx`, add a `getCharacters` fetch (same shape as `getChapters`), fetch it in the `Promise.all`, and add a link.

Replace the file content with:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Novel, Chapter, Character } from '../../types'
import AddChapterForm from './AddChapterForm'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const STATUS_LABELS: Record<Novel['status'], string> = {
  reading: 'Reading',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

const STATUS_COLORS: Record<Novel['status'], string> = {
  reading: 'bg-blue-900 text-blue-300',
  completed: 'bg-green-900 text-green-300',
  dropped: 'bg-red-900 text-red-300',
  on_hold: 'bg-yellow-900 text-yellow-300',
}

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

async function getChapters(id: string): Promise<Chapter[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/novels/${id}/chapters`, { cache: 'no-store' })
    if (!res.ok) return []
    const body = await res.json()
    return (body.data as Chapter[]) ?? []
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

export default async function NovelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [novel, chapters, characters] = await Promise.all([
    getNovel(id),
    getChapters(id),
    getCharacters(id),
  ])

  if (!novel) notFound()

  const sorted = [...chapters].sort((a, b) => a.number - b.number)

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/novels"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
        >
          ← All novels
        </Link>

        <div className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{novel.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[novel.status]}`}
            >
              {STATUS_LABELS[novel.status]}
            </span>
          </div>
          {novel.author && (
            <p className="mb-3 text-sm text-gray-400">by {novel.author}</p>
          )}
          {novel.description && (
            <p className="text-sm leading-relaxed text-gray-300">{novel.description}</p>
          )}
        </div>

        <div className="mb-6 flex gap-4 border-b border-gray-800 pb-3">
          <span className="text-sm font-medium text-gray-200">
            Chapters ({chapters.length})
          </span>
          <Link
            href={`/novels/${id}/characters`}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            Characters ({characters.length})
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-200">Chapters</h2>
          <AddChapterForm novelId={id} />
        </div>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">No chapters yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {sorted.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/novels/${id}/chapters/${chapter.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-900"
                >
                  <span className="text-sm text-white">
                    Ch. {chapter.number} — {chapter.title}
                  </span>
                  {chapter.read_at && (
                    <span className="text-xs text-gray-500">{chapter.read_at}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/novels/[id]/page.tsx"
git commit -m "feat: novel page shows Characters link with count"
```

---

## Task 24: Final verify

- [ ] **Step 1: Run all Go tests**

```bash
cd apps/api && go test ./...
```

Expected: `ok github.com/Namchok/noveldex/api/internal/util`.

- [ ] **Step 2: Build API**

```bash
cd apps/api && go build ./...
```

Expected: no output.

- [ ] **Step 3: Lint web**

```bash
cd apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Start full stack**

```bash
make dev
```

- [ ] **Step 5: Manual test flow**

1. Open `http://localhost:3000/novels`
2. Open a novel → verify "Characters (0)" link appears in the tab bar
3. Click "Characters (0)" → characters page loads, empty state shown
4. Click "+ Add character" → fill in Name: `Elara`, Role: `protagonist`, Description: `The hero` → submit
5. Character appears in list with blue "protagonist" badge and "0 ch"
6. Click `Elara` → profile page loads, "Appears in: No chapters linked yet."
7. Go back to novel → open a chapter → verify "Characters in this chapter" panel is empty
8. In panel, click "+ Link character" → `Elara` appears in dropdown → click her
9. Panel refreshes showing `Elara` chip with × button
10. Go back to chapter, type `[[El` in summary textarea → autocomplete dropdown shows `Elara` → press Enter → `[[Elara]]` inserted
11. Click "Save summary" → after save, view mode shows `Elara` as a blue underlined link
12. Click the link → goes to `Elara`'s profile page
13. Profile page "Appears in" now lists the chapter
14. Click × to unlink Elara from the chapter → panel refreshes without her

- [ ] **Step 6: Update PROGRESS.md**

Change Phase 2 checkboxes to checked:

```markdown
## Phase 2: Characters

- [x] characters table + migration
- [x] character↔novel join table
- [x] CRUD endpoints for characters
- [x] Character profile page
- [x] Chapter ↔ character appearance linking
```

- [ ] **Step 7: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: mark Phase 2 complete"
```
