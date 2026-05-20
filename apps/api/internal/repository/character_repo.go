package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Namchok/noveldex/api/internal/domain"
)

type pgxCharacterRepo struct {
	pool *pgxpool.Pool
}

func NewCharacterRepository(pool *pgxpool.Pool) domain.CharacterRepository {
	return &pgxCharacterRepo{pool: pool}
}

func (r *pgxCharacterRepo) List(ctx context.Context, novelID string) ([]domain.Character, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.novel_id, c.name, c.aliases, c.role, c.description,
		       c.first_appearance_chapter_id, c.created_at, c.updated_at,
		       COUNT(cc.chapter_id) AS chapter_count
		FROM characters c
		LEFT JOIN chapter_characters cc ON cc.character_id = c.id
		WHERE c.novel_id = $1
		GROUP BY c.id
		ORDER BY c.role, c.name
	`, novelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chars []domain.Character
	for rows.Next() {
		var c domain.Character
		if err := rows.Scan(
			&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
			&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt, &c.ChapterCount,
		); err != nil {
			return nil, err
		}
		if c.Aliases == nil {
			c.Aliases = []string{}
		}
		chars = append(chars, c)
	}
	return chars, rows.Err()
}

func (r *pgxCharacterRepo) Create(ctx context.Context, c *domain.Character) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO characters
		  (novel_id, name, aliases, role, description, first_appearance_chapter_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, c.NovelID, c.Name, c.Aliases, c.Role, c.Description,
		c.FirstAppearanceChapterID, c.CreatedAt, c.UpdatedAt,
	).Scan(&c.ID)
}

func (r *pgxCharacterRepo) GetByID(ctx context.Context, novelID, id string) (*domain.Character, error) {
	var c domain.Character
	err := r.pool.QueryRow(ctx, `
		SELECT id, novel_id, name, aliases, role, description,
		       first_appearance_chapter_id, created_at, updated_at
		FROM characters WHERE id = $1 AND novel_id = $2
	`, id, novelID).Scan(
		&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
		&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if c.Aliases == nil {
		c.Aliases = []string{}
	}

	rows, err := r.pool.Query(ctx, `
		SELECT ch.id, ch.number, ch.title, ch.read_at
		FROM chapters ch
		JOIN chapter_characters cc ON cc.chapter_id = ch.id
		WHERE cc.character_id = $1
		ORDER BY ch.number ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	c.Chapters = []domain.ChapterSummary{}
	for rows.Next() {
		var s domain.ChapterSummary
		if err := rows.Scan(&s.ID, &s.Number, &s.Title, &s.ReadAt); err != nil {
			return nil, err
		}
		c.Chapters = append(c.Chapters, s)
	}
	c.ChapterCount = len(c.Chapters)
	return &c, rows.Err()
}

func (r *pgxCharacterRepo) Update(ctx context.Context, c *domain.Character) error {
	err := r.pool.QueryRow(ctx, `
		UPDATE characters
		SET name = $3, aliases = $4, role = $5, description = $6,
		    first_appearance_chapter_id = $7, updated_at = NOW()
		WHERE id = $1 AND novel_id = $2
		RETURNING updated_at
	`, c.ID, c.NovelID, c.Name, c.Aliases, c.Role, c.Description,
		c.FirstAppearanceChapterID,
	).Scan(&c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *pgxCharacterRepo) Delete(ctx context.Context, novelID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM characters WHERE id = $1 AND novel_id = $2`, id, novelID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxCharacterRepo) ListByChapter(ctx context.Context, chapterID string) ([]domain.Character, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.novel_id, c.name, c.aliases, c.role, c.description,
		       c.first_appearance_chapter_id, c.created_at, c.updated_at
		FROM characters c
		JOIN chapter_characters cc ON cc.character_id = c.id
		WHERE cc.chapter_id = $1
		ORDER BY c.name
	`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chars []domain.Character
	for rows.Next() {
		var c domain.Character
		if err := rows.Scan(
			&c.ID, &c.NovelID, &c.Name, &c.Aliases, &c.Role, &c.Description,
			&c.FirstAppearanceChapterID, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if c.Aliases == nil {
			c.Aliases = []string{}
		}
		chars = append(chars, c)
	}
	return chars, rows.Err()
}

func (r *pgxCharacterRepo) LinkToChapter(ctx context.Context, chapterID, characterID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO chapter_characters (chapter_id, character_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, chapterID, characterID)
	return err
}

func (r *pgxCharacterRepo) UnlinkFromChapter(ctx context.Context, chapterID, characterID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM chapter_characters WHERE chapter_id = $1 AND character_id = $2`,
		chapterID, characterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *pgxCharacterRepo) LinkMentions(ctx context.Context, chapterID, novelID string, names []string) error {
	if len(names) == 0 {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO chapter_characters (chapter_id, character_id)
		SELECT $1, id FROM characters WHERE novel_id = $2 AND name = ANY($3)
		ON CONFLICT DO NOTHING
	`, chapterID, novelID, names)
	return err
}
