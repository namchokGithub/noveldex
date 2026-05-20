CREATE TABLE characters (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id                    UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  aliases                     TEXT[] DEFAULT '{}',
  role                        TEXT NOT NULL DEFAULT 'minor',
  description                 TEXT,
  first_appearance_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, name)
);

CREATE INDEX idx_characters_novel_id ON characters(novel_id);
