package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxSearchRepo struct {
	pool *pgxpool.Pool
}

func NewSearchRepository(pool *pgxpool.Pool) domain.SearchRepository {
	return &pgxSearchRepo{pool: pool}
}

func (r *pgxSearchRepo) SearchChapters(ctx context.Context, novelID, tsQuery string) ([]domain.ChapterSnippet, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.number, c.title,
		  ts_headline('simple', coalesce(c.summary,''), query,
		    'MaxWords=15, MinWords=8, StartSel=<mark>, StopSel=</mark>'
		  ) AS summary_snippet
		FROM chapters c
		JOIN volumes v ON v.id = c.volume_id,
		to_tsquery('simple', $1 || ':*') query
		WHERE v.novel_id = $2
		  AND c.search_vector @@ query
		ORDER BY ts_rank(c.search_vector, query) DESC
		LIMIT 10
	`, tsQuery, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.ChapterSnippet
	for rows.Next() {
		var s domain.ChapterSnippet
		if err := rows.Scan(&s.ID, &s.Number, &s.Title, &s.SummarySnippet); err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []domain.ChapterSnippet{}
	}
	return results, rows.Err()
}

func (r *pgxSearchRepo) SearchCharacters(ctx context.Context, novelID, tsQuery string) ([]domain.CharacterSnippet, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, role,
		  ts_headline('simple', coalesce(description,''), query,
		    'MaxWords=15, MinWords=8, StartSel=<mark>, StopSel=</mark>'
		  ) AS description_snippet
		FROM characters, to_tsquery('simple', $1 || ':*') query
		WHERE novel_id = $2
		  AND search_vector @@ query
		ORDER BY ts_rank(search_vector, query) DESC
		LIMIT 10
	`, tsQuery, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.CharacterSnippet
	for rows.Next() {
		var s domain.CharacterSnippet
		if err := rows.Scan(&s.ID, &s.Name, &s.Role, &s.DescriptionSnippet); err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []domain.CharacterSnippet{}
	}
	return results, rows.Err()
}

func (r *pgxSearchRepo) SearchEvents(ctx context.Context, novelID, rawQuery string) ([]domain.EventSnippet, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, title, description, story_date
		FROM events
		WHERE novel_id = $1
		  AND (title ILIKE $2 OR description ILIKE $2)
		LIMIT 10
	`, novelID, "%"+rawQuery+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.EventSnippet
	for rows.Next() {
		var s domain.EventSnippet
		if err := rows.Scan(&s.ID, &s.Title, &s.Description, &s.StoryDate); err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []domain.EventSnippet{}
	}
	return results, rows.Err()
}
