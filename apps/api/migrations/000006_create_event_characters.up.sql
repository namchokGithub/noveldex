CREATE TABLE event_characters (
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, character_id)
);

CREATE INDEX idx_event_characters_character_id ON event_characters(character_id);
