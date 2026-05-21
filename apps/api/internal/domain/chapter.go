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
