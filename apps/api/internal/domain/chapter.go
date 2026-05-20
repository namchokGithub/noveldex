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
	Tags      []Tag      `json:"tags"`
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
