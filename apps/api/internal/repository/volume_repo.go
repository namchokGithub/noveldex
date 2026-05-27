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

func (r *pgxVolumeRepo) List(ctx context.Context, novelID string) ([]domain.Volume, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, novel_id, number, title, created_at, updated_at
		 FROM volumes WHERE novel_id=$1 ORDER BY number ASC`,
		novelID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volumes []domain.Volume
	for rows.Next() {
		var v domain.Volume
		if err := rows.Scan(&v.ID, &v.NovelID, &v.Number, &v.Title, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		volumes = append(volumes, v)
	}
	return volumes, rows.Err()
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
		`SELECT id, novel_id, number, title, created_at, updated_at
		 FROM volumes WHERE id=$1 AND novel_id=$2`,
		id, novelID,
	).Scan(&v.ID, &v.NovelID, &v.Number, &v.Title, &v.CreatedAt, &v.UpdatedAt)
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
