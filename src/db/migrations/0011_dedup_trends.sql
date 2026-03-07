-- One-time deduplication of the trends table.
-- Keeps the highest-scoring trend per (topic_id, normalised dedup key).
-- The dedup key mirrors the scanner's logic: lower(regexp_replace(coalesce(source_url, title), '\s+', ' ', 'g'))
DELETE FROM trends
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY topic_id, lower(regexp_replace(coalesce(source_url, title), '\s+', ' ', 'g'))
        ORDER BY virality_score DESC, discovered_at DESC, id ASC
      ) AS rn
    FROM trends
  ) ranked
  WHERE rn > 1
);
