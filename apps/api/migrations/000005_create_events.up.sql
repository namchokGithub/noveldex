CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id    UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id  UUID REFERENCES chapters(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  story_date  TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_novel_id ON events(novel_id);
