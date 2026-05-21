-- 1. Add nullable volume_id FK
ALTER TABLE chapters
  ADD COLUMN volume_id UUID REFERENCES volumes(id) ON DELETE CASCADE;

-- 2. Create default "Volume 1" for every existing novel
INSERT INTO volumes (novel_id, number, title)
SELECT id, 1, 'Volume 1' FROM novels;

-- 3. Assign every chapter to its novel's default volume
UPDATE chapters
SET volume_id = (
  SELECT v.id FROM volumes v WHERE v.novel_id = chapters.novel_id ORDER BY v.number LIMIT 1
);

-- 4. Enforce NOT NULL
ALTER TABLE chapters ALTER COLUMN volume_id SET NOT NULL;

-- 5. Drop old index, unique constraint, and novel_id column
DROP INDEX IF EXISTS idx_chapters_novel_id;
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_novel_id_number_key;
ALTER TABLE chapters DROP COLUMN novel_id;

-- 6. Add volume-scoped unique constraint and index
ALTER TABLE chapters ADD CONSTRAINT chapters_volume_id_number_key UNIQUE (volume_id, number);
CREATE INDEX idx_chapters_volume_id ON chapters(volume_id);
