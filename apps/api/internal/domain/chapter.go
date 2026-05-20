package domain

import (
	"context"
	"time"
)

type Chapter struct {
	ID        string
	NovelID   string
	Number    int
	Title     string
	Summary   string
	ReadAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type ChapterRepository interface {
	List(ctx context.Context, novelID string) ([]Chapter, error)
	Create(ctx context.Context, ch *Chapter) error
	GetByID(ctx context.Context, novelID, id string) (*Chapter, error)
	Update(ctx context.Context, ch *Chapter) error
	Delete(ctx context.Context, novelID, id string) error
}
