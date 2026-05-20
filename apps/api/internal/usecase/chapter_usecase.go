package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type ChapterUsecase struct {
	repo domain.ChapterRepository
}

func NewChapterUsecase(repo domain.ChapterRepository) *ChapterUsecase {
	return &ChapterUsecase{repo: repo}
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

func (u *ChapterUsecase) Update(ctx context.Context, ch *domain.Chapter) error {
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	return u.repo.Update(ctx, ch)
}

func (u *ChapterUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}
