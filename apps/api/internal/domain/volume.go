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
