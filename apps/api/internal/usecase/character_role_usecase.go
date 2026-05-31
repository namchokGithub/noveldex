package usecase

import (
	"context"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type CharacterRoleUsecase struct {
	repo domain.CharacterRoleRepository
}

func NewCharacterRoleUsecase(repo domain.CharacterRoleRepository) *CharacterRoleUsecase {
	return &CharacterRoleUsecase{repo: repo}
}

func (u *CharacterRoleUsecase) List(ctx context.Context) ([]domain.CharacterRole, error) {
	return u.repo.List(ctx)
}
