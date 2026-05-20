CREATE TABLE chapter_tags (
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, tag_id)
);

CREATE INDEX idx_chapter_tags_tag_id ON chapter_tags(tag_id);
