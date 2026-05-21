CREATE TABLE volumes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id   UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  number     INT NOT NULL,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, number)
);

CREATE INDEX idx_volumes_novel_id ON volumes(novel_id);
