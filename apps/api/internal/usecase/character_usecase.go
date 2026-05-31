package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type CharacterUsecase struct {
	repo     domain.CharacterRepository
	roleRepo domain.CharacterRoleRepository
}

func NewCharacterUsecase(repo domain.CharacterRepository, roleRepo domain.CharacterRoleRepository) *CharacterUsecase {
	return &CharacterUsecase{repo: repo, roleRepo: roleRepo}
}

func (u *CharacterUsecase) List(ctx context.Context, novelID string) ([]domain.Character, error) {
	return u.repo.List(ctx, novelID)
}

func (u *CharacterUsecase) ListPaginated(ctx context.Context, novelID string, page, perPage int) (*domain.CharacterPage, error) {
	chars, err := u.repo.ListPaginated(ctx, novelID, page, perPage)
	if err != nil {
		return nil, err
	}
	if chars == nil {
		chars = &domain.CharacterPage{
			Items: []domain.Character{},
			Pagination: domain.Pagination{
				Page:       1,
				PerPage:    perPage,
				TotalPages: 1,
			},
			Summary: domain.CharacterListSummary{},
		}
	}
	return chars, nil
}

func (u *CharacterUsecase) Create(ctx context.Context, c *domain.Character) error {
	if c.NovelID == "" {
		return errors.New("novel_id is required")
	}
	if c.Name == "" {
		return errors.New("name is required")
	}
	if c.Aliases == nil {
		c.Aliases = []string{}
	}
	role, err := u.resolveRole(ctx, c.RoleID, c.Role)
	if err != nil {
		return err
	}
	c.RoleID = role.ID
	c.Role = role.Code
	c.RoleName = role.Name
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
	role, err := u.resolveRole(ctx, c.RoleID, c.Role)
	if err != nil {
		return err
	}
	c.RoleID = role.ID
	c.Role = role.Code
	c.RoleName = role.Name
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

func (u *CharacterUsecase) resolveRole(ctx context.Context, roleID, roleCode string) (*domain.CharacterRole, error) {
	if strings.TrimSpace(roleID) != "" {
		role, err := u.roleRepo.GetByID(ctx, roleID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return nil, errors.New("invalid role_id")
			}
			return nil, err
		}
		return role, nil
	}

	code := strings.TrimSpace(roleCode)
	if code == "" {
		code = "minor"
	}
	role, err := u.roleRepo.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, errors.New("invalid role")
		}
		return nil, err
	}
	return role, nil
}
