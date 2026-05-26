package domain

import "context"

type Tag struct {
	ID      string `json:"id"`
	NovelID string `json:"novel_id"`
	Name    string `json:"name"`
}

type ChapterSnippet struct {
	ID             string `json:"id"`
	VolumeID       string `json:"volume_id"`
	Number         int    `json:"number"`
	Title          string `json:"title"`
	SummarySnippet string `json:"summary_snippet"`
}

type CharacterSnippet struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Role               string `json:"role"`
	DescriptionSnippet string `json:"description_snippet"`
}

type EventSnippet struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	StoryDate   string `json:"story_date"`
}

type SearchResult struct {
	Chapters   []ChapterSnippet   `json:"chapters"`
	Characters []CharacterSnippet `json:"characters"`
	Events     []EventSnippet     `json:"events"`
}

type TagRepository interface {
	ListByNovel(ctx context.Context, novelID string) ([]Tag, error)
	Create(ctx context.Context, t *Tag) error
	Delete(ctx context.Context, novelID, id string) error
	ListByChapter(ctx context.Context, chapterID string) ([]Tag, error)
	LinkToChapter(ctx context.Context, chapterID, tagID string) error
	UnlinkFromChapter(ctx context.Context, chapterID, tagID string) error
}

type SearchRepository interface {
	SearchChapters(ctx context.Context, novelID, tsQuery string) ([]ChapterSnippet, error)
	SearchCharacters(ctx context.Context, novelID, tsQuery string) ([]CharacterSnippet, error)
	SearchEvents(ctx context.Context, novelID, rawQuery string) ([]EventSnippet, error)
}
