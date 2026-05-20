package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxNovelRepo struct {
	pool *pgxpool.Pool
}

func NewNovelRepository(pool *pgxpool.Pool) domain.NovelRepository {
	return &pgxNovelRepo{pool: pool}
}

func (r *pgxNovelRepo) List(ctx context.Context) ([]domain.Novel, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, author, status, description, cover_url, created_at, updated_at
		 FROM novels ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var novels []domain.Novel
	for rows.Next() {
		var n domain.Novel
		if err := rows.Scan(&n.ID, &n.Title, &n.Author, &n.Status, &n.Description, &n.CoverURL, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		novels = append(novels, n)
	}
	return novels, rows.Err()
}

func (r *pgxNovelRepo) Create(ctx context.Context, n *domain.Novel) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO novels (title, author, status, description, cover_url, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		n.Title, n.Author, n.Status, n.Description, n.CoverURL, n.CreatedAt, n.UpdatedAt,
	).Scan(&n.ID)
}

func (r *pgxNovelRepo) GetByID(ctx context.Context, id string) (*domain.Novel, error) {
	var n domain.Novel
	err := r.pool.QueryRow(ctx,
		`SELECT id, title, author, status, description, cover_url, created_at, updated_at
		 FROM novels WHERE id=$1`,
		id,
	).Scan(&n.ID, &n.Title, &n.Author, &n.Status, &n.Description, &n.CoverURL, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &n, nil
}

func (r *pgxNovelRepo) Update(ctx context.Context, n *domain.Novel) error {
	err := r.pool.QueryRow(ctx,
		`UPDATE novels SET title=$2, author=$3, status=$4, description=$5, cover_url=$6, updated_at=NOW()
		 WHERE id=$1 RETURNING updated_at`,
		n.ID, n.Title, n.Author, n.Status, n.Description, n.CoverURL,
	).Scan(&n.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxNovelRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM novels WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
