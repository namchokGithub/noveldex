CREATE TABLE character_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO character_roles (code, name, description, sort_order) VALUES
  ('main', 'Main', 'Primary point-of-view or lead character', 10),
  ('supporting', 'Supporting', 'Important supporting character', 20),
  ('minor', 'Minor', 'Minor or occasional character', 30),
  ('antagonist', 'Antagonist', 'Primary opposing character', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO character_roles (code, name, description, sort_order)
SELECT DISTINCT
  regexp_replace(lower(trim(role)), '[^a-z0-9]+', '_', 'g') AS code,
  initcap(trim(role)) AS name,
  'Imported from legacy character role',
  100
FROM characters
WHERE coalesce(trim(role), '') <> ''
ON CONFLICT (code) DO NOTHING;

ALTER TABLE characters ADD COLUMN role_id UUID;
ALTER TABLE characters ADD COLUMN profile_image_url TEXT;

UPDATE characters c
SET role_id = cr.id
FROM character_roles cr
WHERE cr.code = CASE
  WHEN coalesce(trim(c.role), '') = '' THEN 'minor'
  ELSE regexp_replace(lower(trim(c.role)), '[^a-z0-9]+', '_', 'g')
END;

UPDATE characters
SET role_id = (SELECT id FROM character_roles WHERE code = 'minor')
WHERE role_id IS NULL;

ALTER TABLE characters
  ALTER COLUMN role_id SET NOT NULL;

ALTER TABLE characters
  ADD CONSTRAINT fk_characters_role_id
  FOREIGN KEY (role_id) REFERENCES character_roles(id);

CREATE INDEX idx_characters_role_id ON characters(role_id);

ALTER TABLE characters DROP COLUMN role;
