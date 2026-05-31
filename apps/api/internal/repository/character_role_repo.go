package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxCharacterRoleRepo struct {
	pool *pgxpool.Pool
}

func NewCharacterRoleRepository(pool *pgxpool.Pool) domain.CharacterRoleRepository {
	return &pgxCharacterRoleRepo{pool: pool}
}

func (r *pgxCharacterRoleRepo) List(ctx context.Context) ([]domain.CharacterRole, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, name, description, sort_order, is_active, created_at, updated_at
		FROM character_roles
		WHERE is_active = TRUE
		ORDER BY sort_order ASC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.CharacterRole
	for rows.Next() {
		var role domain.CharacterRole
		if err := rows.Scan(
			&role.ID, &role.Code, &role.Name, &role.Description,
			&role.SortOrder, &role.IsActive, &role.CreatedAt, &role.UpdatedAt,
		); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if roles == nil {
		roles = []domain.CharacterRole{}
	}
	return roles, nil
}

func (r *pgxCharacterRoleRepo) GetByID(ctx context.Context, id string) (*domain.CharacterRole, error) {
	var role domain.CharacterRole
	err := r.pool.QueryRow(ctx, `
		SELECT id, code, name, description, sort_order, is_active, created_at, updated_at
		FROM character_roles
		WHERE id = $1 AND is_active = TRUE
	`, id).Scan(
		&role.ID, &role.Code, &role.Name, &role.Description,
		&role.SortOrder, &role.IsActive, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &role, nil
}

func (r *pgxCharacterRoleRepo) GetByCode(ctx context.Context, code string) (*domain.CharacterRole, error) {
	var role domain.CharacterRole
	err := r.pool.QueryRow(ctx, `
		SELECT id, code, name, description, sort_order, is_active, created_at, updated_at
		FROM character_roles
		WHERE code = $1 AND is_active = TRUE
	`, code).Scan(
		&role.ID, &role.Code, &role.Name, &role.Description,
		&role.SortOrder, &role.IsActive, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &role, nil
}
