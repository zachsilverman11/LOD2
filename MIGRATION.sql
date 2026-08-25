-- Migration: Add segment, intent, bankability, and variant fields to Lead table
-- Run this migration after deploying the code changes

ALTER TABLE "Lead"
ADD COLUMN "segment" TEXT,
ADD COLUMN "intent" TEXT,
ADD COLUMN "bankability" TEXT,
ADD COLUMN "variant" TEXT;

-- Create indexes for new fields if needed for query performance
CREATE INDEX IF NOT EXISTS "Lead_segment_idx" ON "Lead"("segment");
CREATE INDEX IF NOT EXISTS "Lead_intent_idx" ON "Lead"("intent");

-- Optional: Backfill existing leads with default segment 'prime_other'
-- UPDATE "Lead" SET "segment" = 'prime_other' WHERE "segment" IS NULL AND "source" = 'leads_on_demand';
