package usecase

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/util"
)

type ChapterUsecase struct {
	repo     domain.ChapterRepository
	charRepo domain.CharacterRepository
	tagRepo  domain.TagRepository
}

func NewChapterUsecase(repo domain.ChapterRepository, charRepo domain.CharacterRepository, tagRepo domain.TagRepository) *ChapterUsecase {
	return &ChapterUsecase{repo: repo, charRepo: charRepo, tagRepo: tagRepo}
}

func (u *ChapterUsecase) List(ctx context.Context, novelID string) ([]domain.Chapter, error) {
	chapters, err := u.repo.List(ctx, novelID)
	if err != nil {
		return nil, err
	}
	for i := range chapters {
		tags, err := u.tagRepo.ListByChapter(ctx, chapters[i].ID)
		if err != nil {
			return nil, err
		}
		if tags == nil {
			tags = []domain.Tag{}
		}
		chapters[i].Tags = tags
	}
	return chapters, nil
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

func (u *ChapterUsecase) GetByIDWithCharacters(ctx context.Context, novelID, id string) (*domain.ChapterWithCharacters, error) {
	ch, err := u.repo.GetByID(ctx, novelID, id)
	if err != nil {
		return nil, err
	}
	chars, err := u.charRepo.ListByChapter(ctx, id)
	if err != nil {
		return nil, err
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	tags, err := u.tagRepo.ListByChapter(ctx, id)
	if err != nil {
		return nil, err
	}
	if tags == nil {
		tags = []domain.Tag{}
	}
	ch.Tags = tags
	return &domain.ChapterWithCharacters{Chapter: *ch, Characters: chars}, nil
}

func (u *ChapterUsecase) Update(ctx context.Context, ch *domain.Chapter) error {
	if ch.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if ch.Title == "" {
		return errors.New("title is required")
	}
	if err := u.repo.Update(ctx, ch); err != nil {
		return err
	}
	if ch.Summary != "" {
		names := util.ExtractMentions(ch.Summary)
		if len(names) > 0 {
			if err := u.charRepo.LinkMentions(ctx, ch.ID, ch.NovelID, names); err != nil {
				log.Printf("warn: LinkMentions chapter=%s: %v", ch.ID, err)
			}
		}
	}
	return nil
}

func (u *ChapterUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}
