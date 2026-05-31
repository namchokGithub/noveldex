ALTER TABLE characters ADD COLUMN role TEXT;

UPDATE characters c
SET role = cr.code
FROM character_roles cr
WHERE c.role_id = cr.id;

UPDATE characters
SET role = 'minor'
WHERE coalesce(trim(role), '') = '';

ALTER TABLE characters
  ALTER COLUMN role SET DEFAULT 'minor';

ALTER TABLE characters
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE characters DROP CONSTRAINT IF EXISTS fk_characters_role_id;
DROP INDEX IF EXISTS idx_characters_role_id;

ALTER TABLE characters DROP COLUMN role_id;
ALTER TABLE characters DROP COLUMN profile_image_url;

DROP TABLE IF EXISTS character_roles;
