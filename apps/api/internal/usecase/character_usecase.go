package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type CharacterUsecase struct {
	repo domain.CharacterRepository
}

func NewCharacterUsecase(repo domain.CharacterRepository) *CharacterUsecase {
	return &CharacterUsecase{repo: repo}
}

func (u *CharacterUsecase) List(ctx context.Context, novelID string) ([]domain.Character, error) {
	return u.repo.List(ctx, novelID)
}

func (u *CharacterUsecase) Create(ctx context.Context, c *domain.Character) error {
	if c.NovelID == "" {
		return errors.New("novel_id is required")
	}
	if c.Name == "" {
		return errors.New("name is required")
	}
	if c.Role == "" {
		c.Role = "minor"
	}
	if c.Aliases == nil {
		c.Aliases = []string{}
	}
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	return u.repo.Create(ctx, c)
}

func (u *CharacterUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Character, error) {
	return u.repo.GetByID(ctx, novelID, id)
}

func (u *CharacterUsecase) Update(ctx context.Context, c *domain.Character) error {
	if c.Name == "" {
		return errors.New("name is required")
	}
	if c.Role == "" {
		return errors.New("role is required")
	}
	return u.repo.Update(ctx, c)
}

func (u *CharacterUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}

func (u *CharacterUsecase) ListByChapter(ctx context.Context, chapterID string) ([]domain.Character, error) {
	return u.repo.ListByChapter(ctx, chapterID)
}

func (u *CharacterUsecase) LinkToChapter(ctx context.Context, chapterID, characterID string) error {
	return u.repo.LinkToChapter(ctx, chapterID, characterID)
}

func (u *CharacterUsecase) UnlinkFromChapter(ctx context.Context, chapterID, characterID string) error {
	return u.repo.UnlinkFromChapter(ctx, chapterID, characterID)
}
