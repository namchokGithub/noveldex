package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type VolumeUsecase struct {
	repo domain.VolumeRepository
}

func NewVolumeUsecase(repo domain.VolumeRepository) *VolumeUsecase {
	return &VolumeUsecase{repo: repo}
}

func (u *VolumeUsecase) List(ctx context.Context, novelID string) ([]domain.Volume, error) {
	volumes, err := u.repo.List(ctx, novelID)
	if err != nil {
		return nil, err
	}
	if volumes == nil {
		volumes = []domain.Volume{}
	}
	return volumes, nil
}

func (u *VolumeUsecase) Create(ctx context.Context, v *domain.Volume) error {
	if v.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if v.Title == "" {
		return errors.New("title is required")
	}
	now := time.Now()
	v.CreatedAt = now
	v.UpdatedAt = now
	return u.repo.Create(ctx, v)
}

func (u *VolumeUsecase) GetByID(ctx context.Context, novelID, id string) (*domain.Volume, error) {
	return u.repo.GetByID(ctx, novelID, id)
}

func (u *VolumeUsecase) Update(ctx context.Context, v *domain.Volume) error {
	if v.Number <= 0 {
		return errors.New("number must be greater than 0")
	}
	if v.Title == "" {
		return errors.New("title is required")
	}
	return u.repo.Update(ctx, v)
}

func (u *VolumeUsecase) Delete(ctx context.Context, novelID, id string) error {
	return u.repo.Delete(ctx, novelID, id)
}
