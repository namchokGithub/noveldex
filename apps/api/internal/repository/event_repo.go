package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxEventRepo struct {
	pool *pgxpool.Pool
}

func NewEventRepository(pool *pgxpool.Pool) domain.EventRepository {
	return &pgxEventRepo{pool: pool}
}

func (r *pgxEventRepo) List(ctx context.Context, novelID string) ([]domain.Event, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			e.id, e.novel_id, e.chapter_id, e.title, e.description, e.story_date, e.sort_order,
			e.created_at, e.updated_at,
			ch.title AS chapter_title, ch.number AS chapter_number,
			array_agg(c.name) FILTER (WHERE c.id IS NOT NULL) AS character_names
		FROM events e
		LEFT JOIN chapters ch ON ch.id = e.chapter_id
		LEFT JOIN event_characters ec ON ec.event_id = e.id
		LEFT JOIN characters c ON c.id = ec.character_id
		WHERE e.novel_id = $1
		GROUP BY e.id, ch.title, ch.number
		ORDER BY e.sort_order ASC
	`, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		var chapterTitle *string
		var chapterNumber *int
		var characterNames []string
		if err := rows.Scan(
			&e.ID, &e.NovelID, &e.ChapterID, &e.Title, &e.Description, &e.StoryDate, &e.SortOrder,
			&e.CreatedAt, &e.UpdatedAt,
			&chapterTitle, &chapterNumber,
			&characterNames,
		); err != nil {
			return nil, err
		}
		if chapterTitle != nil {
			e.ChapterTitle = *chapterTitle
		}
		e.ChapterNumber = chapterNumber
		if characterNames == nil {
			characterNames = []string{}
		}
		e.CharacterNames = characterNames
		events = append(events, e)
	}
	return events, rows.Err()
}

func (r *pgxEventRepo) Create(ctx context.Context, e *domain.Event) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO events (novel_id, chapter_id, title, description, story_date, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, created_at, updated_at`,
		e.NovelID, e.ChapterID, e.Title, e.Description, e.StoryDate, e.SortOrder,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

func (r *pgxEventRepo) GetByID(ctx context.Context, novelID, id string) (*domain.Event, error) {
	var e domain.Event
	err := r.pool.QueryRow(ctx,
		`SELECT id, novel_id, chapter_id, title, description, story_date, sort_order, created_at, updated_at
		 FROM events WHERE id=$1 AND novel_id=$2`,
		id, novelID,
	).Scan(&e.ID, &e.NovelID, &e.ChapterID, &e.Title, &e.Description, &e.StoryDate, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func (r *pgxEventRepo) Update(ctx context.Context, e *domain.Event) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE events SET chapter_id=$3, title=$4, description=$5, story_date=$6, sort_order=$7, updated_at=NOW()
		 WHERE id=$1 AND novel_id=$2 RETURNING updated_at`,
		e.ID, e.NovelID, e.ChapterID, e.Title, e.Description, e.StoryDate, e.SortOrder,
	).Scan(&e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxEventRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM events WHERE id=$1 AND novel_id=$2`, id, novelID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxEventRepo) LinkCharacter(ctx context.Context, eventID, characterID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO event_characters (event_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		eventID, characterID,
	)
	return err
}

func (r *pgxEventRepo) UnlinkCharacter(ctx context.Context, eventID, characterID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM event_characters WHERE event_id=$1 AND character_id=$2`,
		eventID, characterID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
