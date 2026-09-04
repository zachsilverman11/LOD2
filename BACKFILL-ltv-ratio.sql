-- Backfill: recompute Lead.rawData->ltv_percent from ltv_percent_raw
--
-- ============================================================
-- NOT RUN. This file has not been executed against any database.
-- ============================================================
--
-- Why: the vendor confirmed in writing that LTV is always a RATIO ("0.80"
-- means 80%). The original parser only multiplied values at or below 1.0, so
-- an over-100% LTV was stored 100x too low ("1.10" -> 1.1 instead of 110).
-- See notes/financevine-first-lead-audit.md §2. `ltv_percent_raw` preserved
-- the vendor's original string on every row, so this is a pure recompute —
-- no re-ingest, no vendor round-trip, nothing lost.
--
-- Mirrors parseLtv() in lib/financevine-payload.ts exactly:
--   * strip "%", whitespace and commas
--   * a value carrying an explicit "%" is already a percentage
--   * otherwise multiply by 100 (the ratio convention)
--   * a non-numeric string, or a result outside 0-200, stores NO parsed value
--     (the `ltv_percent` key is removed), matching the adapter's behaviour
--   * round to 2 decimal places
--
-- `ltv_percent_raw` is NEVER modified. The conversion is expressed as a
-- nested CASE so a non-numeric raw string is never fed to a ::numeric cast —
-- SQL guarantees CASE short-circuits, a multi-clause WHERE does not.
--
-- Apply with:
--   psql "$DIRECT_URL" -f BACKFILL-ltv-ratio.sql
--
--
-- ---------- STEP 1: preview (read-only, safe to run any time) ----------
--
-- WITH computed AS (
--   SELECT id, source, raw,
--          CASE WHEN cleaned ~ '^-?[0-9]+(\.[0-9]+)?$'
--               THEN CASE WHEN has_pct THEN cleaned::numeric
--                         ELSE cleaned::numeric * 100 END
--          END AS value
--   FROM (
--     SELECT id, source,
--            "rawData"->>'ltv_percent_raw' AS raw,
--            regexp_replace("rawData"->>'ltv_percent_raw', '[%[:space:],]', '', 'g') AS cleaned,
--            position('%' in "rawData"->>'ltv_percent_raw') > 0 AS has_pct,
--            "rawData"->>'ltv_percent' AS before_value
--     FROM "Lead" WHERE "rawData" ? 'ltv_percent_raw'
--   ) s
-- )
-- SELECT id, source, raw AS raw_value,
--        CASE WHEN value BETWEEN 0 AND 200 THEN round(value, 2)::text
--             ELSE '(key removed)' END AS after_value
-- FROM computed ORDER BY id;
--
--
-- ---------- STEP 2: apply ----------
-- Review the final SELECT before COMMIT. ROLLBACK is safe at any point.

BEGIN;

CREATE TEMP TABLE ltv_backfill ON COMMIT DROP AS
SELECT id,
       CASE WHEN cleaned ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN CASE WHEN has_pct THEN cleaned::numeric
                      ELSE cleaned::numeric * 100 END
       END AS value
FROM (
  SELECT id,
         regexp_replace("rawData"->>'ltv_percent_raw', '[%[:space:],]', '', 'g') AS cleaned,
         position('%' in "rawData"->>'ltv_percent_raw') > 0 AS has_pct
  FROM "Lead"
  WHERE "rawData" ? 'ltv_percent_raw'
) s;

-- 2a. Readable and plausible: write the corrected percentage.
UPDATE "Lead" l
SET "rawData" = jsonb_set(l."rawData", '{ltv_percent}', to_jsonb(round(b.value, 2)), true)
FROM ltv_backfill b
WHERE l.id = b.id
  AND b.value BETWEEN 0 AND 200;

-- 2b. Unreadable or implausible: drop the parsed key, keep the raw string.
UPDATE "Lead" l
SET "rawData" = l."rawData" - 'ltv_percent'
FROM ltv_backfill b
WHERE l.id = b.id
  AND (b.value IS NULL OR b.value NOT BETWEEN 0 AND 200)
  AND l."rawData" ? 'ltv_percent';

-- Verify before committing. No personal data.
SELECT l.id, l.source,
       l."rawData"->>'ltv_percent_raw' AS raw_value,
       l."rawData"->>'ltv_percent'     AS after_value
FROM "Lead" l
WHERE l."rawData" ? 'ltv_percent_raw'
ORDER BY l.id;

COMMIT;
