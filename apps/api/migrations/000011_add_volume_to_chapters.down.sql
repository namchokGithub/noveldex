-- Rollback: volumes table (000010) still exists during this rollback.

-- 1. Restore novel_id (nullable for population)
ALTER TABLE chapters ADD COLUMN novel_id UUID;

-- 2. Populate novel_id from volumes join (volumes still exist at this point)
UPDATE chapters
SET novel_id = (
  SELECT v.novel_id FROM volumes v WHERE v.id = chapters.volume_id
);

-- 3. Enforce NOT NULL
ALTER TABLE chapters ALTER COLUMN novel_id SET NOT NULL;

-- 4. Drop volume constraints and column
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_volume_id_number_key;
DROP INDEX IF EXISTS idx_chapters_volume_id;
ALTER TABLE chapters DROP COLUMN volume_id;

-- 5. Restore old index and unique constraint
ALTER TABLE chapters ADD CONSTRAINT chapters_novel_id_number_key UNIQUE (novel_id, number);
CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);
