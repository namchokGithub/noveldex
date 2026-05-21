package usecase_test

import (
	"context"
	"testing"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type mockVolumeRepo struct {
	createErr error
}

func (m *mockVolumeRepo) List(_ context.Context, _ string) ([]domain.Volume, error) {
	return nil, nil
}
func (m *mockVolumeRepo) Create(_ context.Context, _ *domain.Volume) error { return m.createErr }
func (m *mockVolumeRepo) GetByID(_ context.Context, _, _ string) (*domain.Volume, error) {
	return nil, domain.ErrNotFound
}
func (m *mockVolumeRepo) Update(_ context.Context, _ *domain.Volume) error { return nil }
func (m *mockVolumeRepo) Delete(_ context.Context, _, _ string) error      { return nil }

func TestVolumeUsecase_Create_Validation(t *testing.T) {
	uc := usecase.NewVolumeUsecase(&mockVolumeRepo{})

	tests := []struct {
		name    string
		vol     domain.Volume
		wantErr string
	}{
		{"zero number", domain.Volume{NovelID: "n1", Number: 0, Title: "Vol 1"}, "number must be greater than 0"},
		{"negative number", domain.Volume{NovelID: "n1", Number: -1, Title: "Vol 1"}, "number must be greater than 0"},
		{"empty title", domain.Volume{NovelID: "n1", Number: 1, Title: ""}, "title is required"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.vol
			err := uc.Create(context.Background(), &v)
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantErr)
			}
			if err.Error() != tc.wantErr {
				t.Errorf("got %q, want %q", err.Error(), tc.wantErr)
			}
		})
	}
}

func TestVolumeUsecase_Create_Valid(t *testing.T) {
	uc := usecase.NewVolumeUsecase(&mockVolumeRepo{})
	v := domain.Volume{NovelID: "n1", Number: 1, Title: "Volume 1"}
	if err := uc.Create(context.Background(), &v); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.CreatedAt.IsZero() {
		t.Error("CreatedAt not set by usecase")
	}
}
