package domain

import (
	"context"
	"time"
)

type Event struct {
	ID              string    `json:"id"`
	NovelID         string    `json:"novel_id"`
	ChapterID       *string   `json:"chapter_id"`
	ChapterVolumeID *string   `json:"chapter_volume_id,omitempty"`
	ChapterTitle    string    `json:"chapter_title,omitempty"`
	ChapterNumber   *int      `json:"chapter_number,omitempty"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	StoryDate       string    `json:"story_date"`
	SortOrder       int       `json:"sort_order"`
	CharacterNames  []string  `json:"character_names"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type EventRepository interface {
	List(ctx context.Context, novelID string) ([]Event, error)
	Create(ctx context.Context, e *Event) error
	GetByID(ctx context.Context, novelID, id string) (*Event, error)
	Update(ctx context.Context, e *Event) error
	Delete(ctx context.Context, novelID, id string) error
	LinkCharacter(ctx context.Context, eventID, characterID string) error
	UnlinkCharacter(ctx context.Context, eventID, characterID string) error
}
