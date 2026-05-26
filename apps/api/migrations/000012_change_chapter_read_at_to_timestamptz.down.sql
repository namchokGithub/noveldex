ALTER TABLE chapters
  ALTER COLUMN read_at TYPE DATE
  USING CASE
    WHEN read_at IS NULL THEN NULL
    ELSE read_at::date
  END;
