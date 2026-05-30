package domain

import (
	"context"
	"time"
)

type Volume struct {
	ID           string    `json:"id"`
	NovelID      string    `json:"novel_id"`
	Number       int       `json:"number"`
	Title        string    `json:"title"`
	ChapterCount int       `json:"chapter_count"`
	ReadCount    int       `json:"read_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Pagination struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
}

type VolumeListSummary struct {
	TotalVolumes  int `json:"total_volumes"`
	TotalChapters int `json:"total_chapters"`
	ReadCount     int `json:"read_count"`
}

type VolumePage struct {
	Items      []Volume          `json:"items"`
	Pagination Pagination        `json:"pagination"`
	Summary    VolumeListSummary `json:"summary"`
}

type VolumeRepository interface {
	List(ctx context.Context, novelID string, page, perPage int) (*VolumePage, error)
	GetLastNumber(ctx context.Context, novelID string) (int, error)
	Create(ctx context.Context, v *Volume) error
	GetByID(ctx context.Context, novelID, id string) (*Volume, error)
	Update(ctx context.Context, v *Volume) error
	Delete(ctx context.Context, novelID, id string) error
}
