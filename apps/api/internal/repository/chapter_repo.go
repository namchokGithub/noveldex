package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxChapterRepo struct {
	pool *pgxpool.Pool
}

func NewChapterRepository(pool *pgxpool.Pool) domain.ChapterRepository {
	return &pgxChapterRepo{pool: pool}
}

func (r *pgxChapterRepo) List(ctx context.Context, volumeID string) ([]domain.Chapter, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, volume_id, number, title, summary, read_at, created_at, updated_at
		 FROM chapters WHERE volume_id=$1 ORDER BY number ASC`,
		volumeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chapters []domain.Chapter
	for rows.Next() {
		var ch domain.Chapter
		if err := rows.Scan(&ch.ID, &ch.VolumeID, &ch.Number, &ch.Title, &ch.Summary, &ch.ReadAt, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		chapters = append(chapters, ch)
	}
	return chapters, rows.Err()
}

func (r *pgxChapterRepo) ListByNovel(ctx context.Context, novelID string) ([]domain.Chapter, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT c.id, c.volume_id, c.number, c.title, c.summary, c.read_at, c.created_at, c.updated_at
		 FROM chapters c
		 JOIN volumes v ON v.id = c.volume_id
		 WHERE v.novel_id = $1
		 ORDER BY c.number ASC`,
		novelID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chapters []domain.Chapter
	for rows.Next() {
		var ch domain.Chapter
		if err := rows.Scan(&ch.ID, &ch.VolumeID, &ch.Number, &ch.Title, &ch.Summary, &ch.ReadAt, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		chapters = append(chapters, ch)
	}
	return chapters, rows.Err()
}

func (r *pgxChapterRepo) GetLastNumber(ctx context.Context, volumeID string) (int, error) {
	var last int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0)
		 FROM chapters
		 WHERE volume_id = $1`,
		volumeID,
	).Scan(&last)
	if err != nil {
		return 0, err
	}
	return last, nil
}

func (r *pgxChapterRepo) Create(ctx context.Context, ch *domain.Chapter) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO chapters (volume_id, number, title, summary, read_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		ch.VolumeID, ch.Number, ch.Title, ch.Summary, ch.ReadAt, ch.CreatedAt, ch.UpdatedAt,
	).Scan(&ch.ID)
}

func (r *pgxChapterRepo) GetByID(ctx context.Context, volumeID, id string) (*domain.Chapter, error) {
	var ch domain.Chapter
	err := r.pool.QueryRow(ctx,
		`SELECT id, volume_id, number, title, summary, read_at, created_at, updated_at
		 FROM chapters WHERE id=$1 AND volume_id=$2`,
		id, volumeID,
	).Scan(&ch.ID, &ch.VolumeID, &ch.Number, &ch.Title, &ch.Summary, &ch.ReadAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &ch, nil
}

func (r *pgxChapterRepo) Update(ctx context.Context, ch *domain.Chapter) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE chapters SET number=$3, title=$4, summary=$5, read_at=$6, updated_at=NOW()
		 WHERE id=$1 AND volume_id=$2 RETURNING updated_at`,
		ch.ID, ch.VolumeID, ch.Number, ch.Title, ch.Summary, ch.ReadAt,
	).Scan(&ch.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxChapterRepo) Delete(ctx context.Context, volumeID, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM chapters WHERE id=$1 AND volume_id=$2`, id, volumeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxChapterRepo) NumberExistsInNovel(ctx context.Context, novelID string, number int, excludeID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM chapters c
			JOIN volumes v ON v.id = c.volume_id
			WHERE v.novel_id = $1
			  AND c.number = $2
			  AND (length($3) = 0 OR c.id::text != $3)
		)`,
		novelID, number, excludeID,
	).Scan(&exists)
	return exists, err
}
