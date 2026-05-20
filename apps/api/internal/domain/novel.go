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
