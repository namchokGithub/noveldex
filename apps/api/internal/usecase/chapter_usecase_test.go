package usecase_test

import (
	"context"
	"testing"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type mockChapterRepo struct {
	numberExists bool
	numberErr    error
	createErr    error
}

func (m *mockChapterRepo) List(_ context.Context, _ string) ([]domain.Chapter, error) {
	return nil, nil
}
func (m *mockChapterRepo) ListByNovel(_ context.Context, _ string) ([]domain.Chapter, error) {
	return nil, nil
}
func (m *mockChapterRepo) GetLastNumber(_ context.Context, _ string) (int, error) {
	return 0, nil
}
func (m *mockChapterRepo) Create(_ context.Context, ch *domain.Chapter) error {
	ch.ID = "test-id"
	return m.createErr
}
func (m *mockChapterRepo) GetByID(_ context.Context, _, _ string) (*domain.Chapter, error) {
	return nil, nil
}
func (m *mockChapterRepo) Update(_ context.Context, _ *domain.Chapter) error { return nil }
func (m *mockChapterRepo) Delete(_ context.Context, _, _ string) error       { return nil }
func (m *mockChapterRepo) NumberExistsInNovel(_ context.Context, _ string, _ int, _ string) (bool, error) {
	return m.numberExists, m.numberErr
}

type mockCharRepoStub struct{}

func (m *mockCharRepoStub) List(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) Create(_ context.Context, _ *domain.Character) error { return nil }
func (m *mockCharRepoStub) GetByID(_ context.Context, _, _ string) (*domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) Update(_ context.Context, _ *domain.Character) error { return nil }
func (m *mockCharRepoStub) Delete(_ context.Context, _, _ string) error         { return nil }
func (m *mockCharRepoStub) ListByChapter(_ context.Context, _ string) ([]domain.Character, error) {
	return nil, nil
}
func (m *mockCharRepoStub) LinkToChapter(_ context.Context, _, _ string) error     { return nil }
func (m *mockCharRepoStub) UnlinkFromChapter(_ context.Context, _, _ string) error { return nil }
func (m *mockCharRepoStub) LinkMentions(_ context.Context, _, _ string, _ []string) error {
	return nil
}

type mockTagRepoStub struct{}

func (m *mockTagRepoStub) ListByNovel(_ context.Context, _ string) ([]domain.Tag, error) {
	return nil, nil
}
func (m *mockTagRepoStub) Create(_ context.Context, _ *domain.Tag) error { return nil }
func (m *mockTagRepoStub) Delete(_ context.Context, _, _ string) error   { return nil }
func (m *mockTagRepoStub) ListByChapter(_ context.Context, _ string) ([]domain.Tag, error) {
	return nil, nil
}
func (m *mockTagRepoStub) LinkToChapter(_ context.Context, _, _ string) error     { return nil }
func (m *mockTagRepoStub) UnlinkFromChapter(_ context.Context, _, _ string) error { return nil }

func newTestChapterUsecase(cr *mockChapterRepo) *usecase.ChapterUsecase {
	return usecase.NewChapterUsecase(cr, &mockCharRepoStub{}, &mockTagRepoStub{})
}

func TestChapterUsecase_Create_MissingVolumeID(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{})
	ch := domain.Chapter{Number: 5, Title: "Ch 5"}
	err := uc.Create(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "volume_id is required" {
		t.Errorf("got %v, want %q", err, "volume_id is required")
	}
}

func TestChapterUsecase_Create_DuplicateNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: true})
	ch := domain.Chapter{VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	err := uc.Create(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "chapter number already exists in this novel" {
		t.Errorf("got %v, want %q", err, "chapter number already exists in this novel")
	}
}

func TestChapterUsecase_Create_UniqueNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: false})
	ch := domain.Chapter{VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	if err := uc.Create(context.Background(), "novel-1", &ch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestChapterUsecase_Update_DuplicateNumber(t *testing.T) {
	uc := newTestChapterUsecase(&mockChapterRepo{numberExists: true})
	ch := domain.Chapter{ID: "ch-1", VolumeID: "vol-1", Number: 5, Title: "Ch 5"}
	err := uc.Update(context.Background(), "novel-1", &ch)
	if err == nil || err.Error() != "chapter number already exists in this novel" {
		t.Errorf("got %v, want %q", err, "chapter number already exists in this novel")
	}
}
