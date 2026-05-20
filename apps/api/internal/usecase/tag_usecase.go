package usecase

import (
	"context"
	"fmt"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type TagUsecase struct {
	repo domain.TagRepository
}

func NewTagUsecase(repo domain.TagRepository) *TagUsecase {
	return &TagUsecase{repo: repo}
}

func (uc *TagUsecase) ListByNovel(ctx context.Context, novelID string) ([]domain.Tag, error) {
	return uc.repo.ListByNovel(ctx, novelID)
}

func (uc *TagUsecase) Create(ctx context.Context, t *domain.Tag) error {
	if t.Name == "" {
		return fmt.Errorf("name is required")
	}
	return uc.repo.Create(ctx, t)
}

func (uc *TagUsecase) Delete(ctx context.Context, novelID, id string) error {
	return uc.repo.Delete(ctx, novelID, id)
}

func (uc *TagUsecase) LinkToChapter(ctx context.Context, chapterID, tagID string) error {
	return uc.repo.LinkToChapter(ctx, chapterID, tagID)
}

func (uc *TagUsecase) UnlinkFromChapter(ctx context.Context, chapterID, tagID string) error {
	return uc.repo.UnlinkFromChapter(ctx, chapterID, tagID)
}
