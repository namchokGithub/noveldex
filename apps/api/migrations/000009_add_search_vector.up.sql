ALTER TABLE chapters
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' || coalesce(summary, '')
    )
  ) STORED;

CREATE INDEX idx_chapters_search_vector ON chapters USING GIN (search_vector);

ALTER TABLE characters
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX idx_characters_search_vector ON characters USING GIN (search_vector);
