-- First, check what values currently exist
SELECT unnest(enum_range(NULL::"LeadStatus"))::text AS current_values;

-- Remove QUALIFIED if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QUALIFIED' AND enumtypid = 'LeadStatus'::regtype) THEN
        ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
        CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ENGAGED', 'CALL_SCHEDULED', 'CALL_COMPLETED', 'APPLICATION_STARTED', 'CONVERTED', 'NURTURING', 'LOST');
        ALTER TABLE "Lead" ALTER COLUMN status TYPE "LeadStatus" USING status::text::"LeadStatus";
        DROP TYPE "LeadStatus_old";
    END IF;
END$$;

-- Remove APPLICATION_COMPLETED if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'APPLICATION_COMPLETED' AND enumtypid = 'LeadStatus'::regtype) THEN
        ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
        CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ENGAGED', 'CALL_SCHEDULED', 'CALL_COMPLETED', 'APPLICATION_STARTED', 'CONVERTED', 'NURTURING', 'LOST');
        ALTER TABLE "Lead" ALTER COLUMN status TYPE "LeadStatus" USING status::text::"LeadStatus";
        DROP TYPE "LeadStatus_old";
    END IF;
END$$;

-- Add NURTURING if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'NURTURING' AND enumtypid = 'LeadStatus'::regtype) THEN
        ALTER TYPE "LeadStatus" ADD VALUE 'NURTURING';
    END IF;
END$$;

-- Add LOST if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOST' AND enumtypid = 'LeadStatus'::regtype) THEN
        ALTER TYPE "LeadStatus" ADD VALUE 'LOST';
    END IF;
END$$;

-- Verify final enum values
SELECT unnest(enum_range(NULL::"LeadStatus"))::text AS final_values;
