package domain

import (
	"context"
	"time"
)

type Character struct {
	ID                       string           `json:"id"`
	NovelID                  string           `json:"novel_id"`
	Name                     string           `json:"name"`
	Aliases                  []string         `json:"aliases"`
	Role                     string           `json:"role"`
	Description              string           `json:"description"`
	FirstAppearanceChapterID *string          `json:"first_appearance_chapter_id"`
	ChapterCount             int              `json:"chapter_count"`
	Chapters                 []ChapterSummary `json:"chapters,omitempty"`
	CreatedAt                time.Time        `json:"created_at"`
	UpdatedAt                time.Time        `json:"updated_at"`
}

type ChapterSummary struct {
	ID       string     `json:"id"`
	VolumeID string     `json:"volume_id"`
	Number   int        `json:"number"`
	Title    string     `json:"title"`
	ReadAt   *time.Time `json:"read_at"`
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
