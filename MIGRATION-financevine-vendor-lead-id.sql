-- Migration: add Lead.vendorLeadId (FinanceVine vendor schema support)
--
-- GENERATED BUT NOT APPLIED. Nothing here has been run against any database.
--
-- Adds the lead vendor's own unique id for a lead. FinanceVine sends it as
-- `id`; the webhook uses it as the PRIMARY dedupe key, ahead of phone/email,
-- so a returning lead who changes their email still matches their existing
-- row instead of creating a second one.
--
-- Safe to apply before or after the code deploy:
--   * The column is NULLABLE with no default and is NOT backfilled. Every
--     existing lead keeps NULL and continues to dedupe on phone/email exactly
--     as it does today.
--   * Deliberately NOT UNIQUE. Two sources could in principle collide on an id
--     string, and a unique violation at ingest would drop a real lead; the
--     webhook resolves duplicates in application code instead.
--
-- Apply with (against the target database, from the repo root):
--   npx prisma db execute --file MIGRATION-financevine-vendor-lead-id.sql --schema prisma/schema.prisma
--
-- Or directly:
--   psql "$DATABASE_URL" -f MIGRATION-financevine-vendor-lead-id.sql

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "vendorLeadId" TEXT;

-- Dedupe reads this column on every FinanceVine ingest.
CREATE INDEX IF NOT EXISTS "Lead_vendorLeadId_idx" ON "Lead"("vendorLeadId");
