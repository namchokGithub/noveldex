package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type NovelUsecase struct {
	repo domain.NovelRepository
}

func NewNovelUsecase(repo domain.NovelRepository) *NovelUsecase {
	return &NovelUsecase{repo: repo}
}

func (u *NovelUsecase) List(ctx context.Context) ([]domain.Novel, error) {
	return u.repo.List(ctx)
}

func (u *NovelUsecase) Create(ctx context.Context, n *domain.Novel) error {
	if n.Title == "" {
		return errors.New("title is required")
	}
	if n.Status == "" {
		n.Status = "reading"
	}
	now := time.Now()
	n.CreatedAt = now
	n.UpdatedAt = now
	return u.repo.Create(ctx, n)
}

func (u *NovelUsecase) GetByID(ctx context.Context, id string) (*domain.Novel, error) {
	return u.repo.GetByID(ctx, id)
}

func (u *NovelUsecase) Update(ctx context.Context, n *domain.Novel) error {
	if n.Title == "" {
		return errors.New("title is required")
	}
	return u.repo.Update(ctx, n)
}

func (u *NovelUsecase) Delete(ctx context.Context, id string) error {
	return u.repo.Delete(ctx, id)
}
