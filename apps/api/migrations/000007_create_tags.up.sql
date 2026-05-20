CREATE TABLE tags (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  UNIQUE (novel_id, name)
);

CREATE INDEX idx_tags_novel_id ON tags(novel_id);
