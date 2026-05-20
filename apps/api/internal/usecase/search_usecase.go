package usecase

import (
	"context"
	"strings"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type SearchUsecase struct {
	repo domain.SearchRepository
}

func NewSearchUsecase(repo domain.SearchRepository) *SearchUsecase {
	return &SearchUsecase{repo: repo}
}

func (uc *SearchUsecase) Search(ctx context.Context, novelID, q, searchType string) (*domain.SearchResult, error) {
	tsq := strings.Join(strings.Fields(q), " & ")
	result := &domain.SearchResult{
		Chapters:   []domain.ChapterSnippet{},
		Characters: []domain.CharacterSnippet{},
		Events:     []domain.EventSnippet{},
	}

	if searchType == "all" || searchType == "chapters" {
		chapters, err := uc.repo.SearchChapters(ctx, novelID, tsq)
		if err != nil {
			return nil, err
		}
		if chapters != nil {
			result.Chapters = chapters
		}
	}
	if searchType == "all" || searchType == "characters" {
		characters, err := uc.repo.SearchCharacters(ctx, novelID, tsq)
		if err != nil {
			return nil, err
		}
		if characters != nil {
			result.Characters = characters
		}
	}
	if searchType == "all" || searchType == "events" {
		events, err := uc.repo.SearchEvents(ctx, novelID, q)
		if err != nil {
			return nil, err
		}
		if events != nil {
			result.Events = events
		}
	}
	return result, nil
}
