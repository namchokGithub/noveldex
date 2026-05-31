package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type mockCharacterRepo struct {
	created *domain.Character
	updated *domain.Character
}

func (m *mockCharacterRepo) List(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharacterRepo) ListPaginated(_ context.Context, _ string, page, perPage int) (*domain.CharacterPage, error) {
	return &domain.CharacterPage{
		Items: []domain.Character{},
		Pagination: domain.Pagination{
			Page:       page,
			PerPage:    perPage,
			TotalPages: 1,
		},
	}, nil
}
func (m *mockCharacterRepo) Create(_ context.Context, c *domain.Character) error {
	clone := *c
	m.created = &clone
	c.ID = "char-1"
	return nil
}
func (m *mockCharacterRepo) GetByID(_ context.Context, _, _ string) (*domain.Character, error) {
	return nil, nil
}
func (m *mockCharacterRepo) Update(_ context.Context, c *domain.Character) error {
	clone := *c
	m.updated = &clone
	return nil
}
func (m *mockCharacterRepo) Delete(_ context.Context, _, _ string) error { return nil }
func (m *mockCharacterRepo) ListByChapter(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharacterRepo) LinkToChapter(_ context.Context, _, _ string) error     { return nil }
func (m *mockCharacterRepo) UnlinkFromChapter(_ context.Context, _, _ string) error { return nil }
func (m *mockCharacterRepo) LinkMentions(_ context.Context, _, _ string, _ []string) error {
	return nil
}

type mockCharacterRoleRepo struct {
	rolesByID   map[string]domain.CharacterRole
	rolesByCode map[string]domain.CharacterRole
}

func (m *mockCharacterRoleRepo) List(_ context.Context) ([]domain.CharacterRole, error) {
	return nil, nil
}
func (m *mockCharacterRoleRepo) GetByID(_ context.Context, id string) (*domain.CharacterRole, error) {
	role, ok := m.rolesByID[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return &role, nil
}
func (m *mockCharacterRoleRepo) GetByCode(_ context.Context, code string) (*domain.CharacterRole, error) {
	role, ok := m.rolesByCode[code]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return &role, nil
}

func TestCharacterUsecase_Create_DefaultRoleByCode(t *testing.T) {
	charRepo := &mockCharacterRepo{}
	roleRepo := &mockCharacterRoleRepo{
		rolesByCode: map[string]domain.CharacterRole{
			"minor": {ID: "role-minor", Code: "minor", Name: "Minor"},
		},
	}
	uc := usecase.NewCharacterUsecase(charRepo, roleRepo)

	c := &domain.Character{
		NovelID: "novel-1",
		Name:    "Test",
	}

	if err := uc.Create(context.Background(), c); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if charRepo.created == nil {
		t.Fatal("expected create call")
	}
	if charRepo.created.RoleID != "role-minor" {
		t.Fatalf("got role_id %q, want %q", charRepo.created.RoleID, "role-minor")
	}
	if charRepo.created.Role != "minor" {
		t.Fatalf("got role %q, want %q", charRepo.created.Role, "minor")
	}
}

func TestCharacterUsecase_Create_InvalidRoleCode(t *testing.T) {
	uc := usecase.NewCharacterUsecase(&mockCharacterRepo{}, &mockCharacterRoleRepo{})

	err := uc.Create(context.Background(), &domain.Character{
		NovelID: "novel-1",
		Name:    "Test",
		Role:    "unknown",
	})
	if err == nil || err.Error() != "invalid role" {
		t.Fatalf("got %v, want %q", err, "invalid role")
	}
}

func TestCharacterUsecase_Update_ResolveByRoleID(t *testing.T) {
	charRepo := &mockCharacterRepo{}
	roleRepo := &mockCharacterRoleRepo{
		rolesByID: map[string]domain.CharacterRole{
			"role-main": {ID: "role-main", Code: "main", Name: "Main"},
		},
	}
	uc := usecase.NewCharacterUsecase(charRepo, roleRepo)

	c := &domain.Character{
		ID:      "char-1",
		NovelID: "novel-1",
		Name:    "Hero",
		RoleID:  "role-main",
	}
	if err := uc.Update(context.Background(), c); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if charRepo.updated == nil {
		t.Fatal("expected update call")
	}
	if charRepo.updated.Role != "main" {
		t.Fatalf("got role %q, want %q", charRepo.updated.Role, "main")
	}
	if charRepo.updated.RoleName != "Main" {
		t.Fatalf("got role_name %q, want %q", charRepo.updated.RoleName, "Main")
	}
}

func TestCharacterUsecase_Update_InvalidRoleID(t *testing.T) {
	uc := usecase.NewCharacterUsecase(&mockCharacterRepo{}, &mockCharacterRoleRepo{})

	err := uc.Update(context.Background(), &domain.Character{
		ID:      "char-1",
		NovelID: "novel-1",
		Name:    "Hero",
		RoleID:  "bad-role",
	})
	if err == nil || !errors.Is(err, errors.New("invalid role_id")) && err.Error() != "invalid role_id" {
		t.Fatalf("got %v, want %q", err, "invalid role_id")
	}
}
