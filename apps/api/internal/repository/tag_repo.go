package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxTagRepo struct {
	pool *pgxpool.Pool
}

func NewTagRepository(pool *pgxpool.Pool) domain.TagRepository {
	return &pgxTagRepo{pool: pool}
}

func (r *pgxTagRepo) ListByNovel(ctx context.Context, novelID string) ([]domain.Tag, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, novel_id, name FROM tags WHERE novel_id = $1 ORDER BY name ASC`,
		novelID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []domain.Tag
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.NovelID, &t.Name); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []domain.Tag{}
	}
	return tags, rows.Err()
}

func (r *pgxTagRepo) Create(ctx context.Context, t *domain.Tag) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO tags (novel_id, name) VALUES ($1, $2)
		 ON CONFLICT (novel_id, name) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`,
		t.NovelID, t.Name,
	).Scan(&t.ID)
}

func (r *pgxTagRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM tags WHERE id = $1 AND novel_id = $2`,
		id, novelID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxTagRepo) ListByChapter(ctx context.Context, chapterID string) ([]domain.Tag, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.novel_id, t.name
		 FROM tags t
		 JOIN chapter_tags ct ON ct.tag_id = t.id
		 WHERE ct.chapter_id = $1
		 ORDER BY t.name ASC`,
		chapterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []domain.Tag
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.NovelID, &t.Name); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []domain.Tag{}
	}
	return tags, rows.Err()
}

func (r *pgxTagRepo) LinkToChapter(ctx context.Context, chapterID, tagID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO chapter_tags (chapter_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		chapterID, tagID,
	)
	return err
}

func (r *pgxTagRepo) UnlinkFromChapter(ctx context.Context, chapterID, tagID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM chapter_tags WHERE chapter_id = $1 AND tag_id = $2`,
		chapterID, tagID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
