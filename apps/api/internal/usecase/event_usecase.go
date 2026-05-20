package usecase

import (
	"context"
	"fmt"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type EventUsecase struct {
	repo domain.EventRepository
}

func NewEventUsecase(repo domain.EventRepository) *EventUsecase {
	return &EventUsecase{repo: repo}
}

func (uc *EventUsecase) List(ctx context.Context, novelID string) ([]domain.Event, error) {
	return uc.repo.List(ctx, novelID)
}

func (uc *EventUsecase) Create(ctx context.Context, e *domain.Event) error {
	if e.Title == "" {
		return fmt.Errorf("title is required")
	}
	if e.StoryDate == "" {
		return fmt.Errorf("story_date is required")
	}
	return uc.repo.Create(ctx, e)
}

func (uc *EventUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Event, error) {
	return uc.repo.GetByID(ctx, novelID, id)
}

func (uc *EventUsecase) Update(ctx context.Context, e *domain.Event) error {
	return uc.repo.Update(ctx, e)
}

func (uc *EventUsecase) Delete(ctx context.Context, novelID, id string) error {
	return uc.repo.Delete(ctx, novelID, id)
}

func (uc *EventUsecase) LinkCharacter(ctx context.Context, eventID, characterID string) error {
	return uc.repo.LinkCharacter(ctx, eventID, characterID)
}

func (uc *EventUsecase) UnlinkCharacter(ctx context.Context, eventID, characterID string) error {
	return uc.repo.UnlinkCharacter(ctx, eventID, characterID)
}
