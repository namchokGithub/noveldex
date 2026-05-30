package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxVolumeRepo struct {
	pool *pgxpool.Pool
}

func NewVolumeRepository(pool *pgxpool.Pool) domain.VolumeRepository {
	return &pgxVolumeRepo{pool: pool}
}

func (r *pgxVolumeRepo) List(ctx context.Context, novelID string, page, perPage int) (*domain.VolumePage, error) {
	var summary domain.VolumeListSummary
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT v.id) AS total_volumes,
		        COUNT(c.id) AS total_chapters,
		        COUNT(c.read_at) AS read_count
		 FROM volumes v
		 LEFT JOIN chapters c ON c.volume_id = v.id
		 WHERE v.novel_id=$1`,
		novelID,
	).Scan(&summary.TotalVolumes, &summary.TotalChapters, &summary.ReadCount)
	if err != nil {
		return nil, err
	}

	totalPages := 1
	if summary.TotalVolumes > 0 {
		totalPages = (summary.TotalVolumes + perPage - 1) / perPage
	}
	if page > totalPages {
		page = totalPages
	}

	rows, err := r.pool.Query(ctx,
		`SELECT v.id,
		        v.novel_id,
		        v.number,
		        v.title,
		        COUNT(c.id) AS chapter_count,
		        COUNT(c.read_at) AS read_count,
		        v.created_at,
		        v.updated_at
		 FROM volumes v
		 LEFT JOIN chapters c ON c.volume_id = v.id
		 WHERE v.novel_id=$1
		 GROUP BY v.id, v.novel_id, v.number, v.title, v.created_at, v.updated_at
		 ORDER BY v.number ASC
		 LIMIT $2 OFFSET $3`,
		novelID,
		perPage,
		(page-1)*perPage,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volumes []domain.Volume
	for rows.Next() {
		var v domain.Volume
		if err := rows.Scan(
			&v.ID,
			&v.NovelID,
			&v.Number,
			&v.Title,
			&v.ChapterCount,
			&v.ReadCount,
			&v.CreatedAt,
			&v.UpdatedAt,
		); err != nil {
			return nil, err
		}
		volumes = append(volumes, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if volumes == nil {
		volumes = []domain.Volume{}
	}

	return &domain.VolumePage{
		Items: volumes,
		Pagination: domain.Pagination{
			Page:       page,
			PerPage:    perPage,
			TotalItems: summary.TotalVolumes,
			TotalPages: totalPages,
		},
		Summary: summary,
	}, nil
}

func (r *pgxVolumeRepo) GetLastNumber(ctx context.Context, novelID string) (int, error) {
	var last int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0)
		 FROM volumes
		 WHERE novel_id=$1`,
		novelID,
	).Scan(&last)
	if err != nil {
		return 0, err
	}
	return last, nil
}

func (r *pgxVolumeRepo) Create(ctx context.Context, v *domain.Volume) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO volumes (novel_id, number, title, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		v.NovelID, v.Number, v.Title, v.CreatedAt, v.UpdatedAt,
	).Scan(&v.ID)
}

func (r *pgxVolumeRepo) GetByID(ctx context.Context, novelID, id string) (*domain.Volume, error) {
	var v domain.Volume
	err := r.pool.QueryRow(ctx,
		`SELECT v.id,
		        v.novel_id,
		        v.number,
		        v.title,
		        COUNT(c.id) AS chapter_count,
		        COUNT(c.read_at) AS read_count,
		        v.created_at,
		        v.updated_at
		 FROM volumes v
		 LEFT JOIN chapters c ON c.volume_id = v.id
		 WHERE v.id=$1 AND v.novel_id=$2
		 GROUP BY v.id, v.novel_id, v.number, v.title, v.created_at, v.updated_at`,
		id, novelID,
	).Scan(&v.ID, &v.NovelID, &v.Number, &v.Title, &v.ChapterCount, &v.ReadCount, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

func (r *pgxVolumeRepo) Update(ctx context.Context, v *domain.Volume) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE volumes SET number=$3, title=$4, updated_at=NOW()
		 WHERE id=$1 AND novel_id=$2 RETURNING updated_at`,
		v.ID, v.NovelID, v.Number, v.Title,
	).Scan(&v.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxVolumeRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM volumes WHERE id=$1 AND novel_id=$2`, id, novelID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
