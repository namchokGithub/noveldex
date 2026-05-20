package domain

import (
	"context"
	"time"
)

type Novel struct {
	ID          string
	Title       string
	Author      string
	Status      string
	Description string
	CoverURL    string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type NovelRepository interface {
	List(ctx context.Context) ([]Novel, error)
	Create(ctx context.Context, n *Novel) error
	GetByID(ctx context.Context, id string) (*Novel, error)
	Update(ctx context.Context, n *Novel) error
	Delete(ctx context.Context, id string) error
}
