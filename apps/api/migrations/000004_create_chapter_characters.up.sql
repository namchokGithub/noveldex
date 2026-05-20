CREATE TABLE chapter_characters (
  chapter_id   UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, character_id)
);

CREATE INDEX idx_chapter_characters_character_id ON chapter_characters(character_id);
