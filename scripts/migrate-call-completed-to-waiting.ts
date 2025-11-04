/**
 * Migration Script: CALL_COMPLETED → WAITING_FOR_APPLICATION
 *
 * This script safely migrates the LeadStatus enum and all existing data.
 *
 * Steps:
 * 1. Add WAITING_FOR_APPLICATION to LeadStatus enum (if not exists)
 * 2. Update all CALL_COMPLETED leads to WAITING_FOR_APPLICATION
 * 3. Remove CALL_COMPLETED from LeadStatus enum
 *
 * Run with: npx tsx scripts/migrate-call-completed-to-waiting.ts
 */

import { prisma } from '../lib/db';

async function migrateCallCompletedToWaiting() {
  console.log('='.repeat(80));
  console.log('MIGRATION: CALL_COMPLETED → WAITING_FOR_APPLICATION');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Check current state
    console.log('📊 Checking current state...');
    const callCompletedCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Lead"
      WHERE status = 'CALL_COMPLETED'
    `;
    const count = Number(callCompletedCount[0].count);
    console.log(`Found ${count} leads with CALL_COMPLETED status\n`);

    if (count === 0) {
      console.log('✅ No leads to migrate. Proceeding with enum update only.\n');
    }

    // Step 2: Add WAITING_FOR_APPLICATION to enum if it doesn't exist
    console.log('🔧 Step 1: Adding WAITING_FOR_APPLICATION to LeadStatus enum...');

    // Check if WAITING_FOR_APPLICATION already exists
    const enumCheck = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'LeadStatus'
        AND e.enumlabel = 'WAITING_FOR_APPLICATION'
      ) as exists
    `;

    if (!enumCheck[0].exists) {
      // Add the new enum value
      await prisma.$executeRaw`
        ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_APPLICATION'
      `;
      console.log('✅ Added WAITING_FOR_APPLICATION to enum\n');
    } else {
      console.log('✅ WAITING_FOR_APPLICATION already exists in enum\n');
    }

    // Step 3: Migrate data
    if (count > 0) {
      console.log(`🔄 Step 2: Migrating ${count} leads...`);

      // Get the leads to migrate
      const leads = await prisma.$queryRaw<{ id: string; firstName: string; lastName: string }[]>`
        SELECT id, "firstName", "lastName"
        FROM "Lead"
        WHERE status = 'CALL_COMPLETED'
      `;

      console.log('Leads to migrate:');
      leads.forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.id})`);
      });
      console.log();

      // Update all CALL_COMPLETED to WAITING_FOR_APPLICATION
      const result = await prisma.$executeRaw`
        UPDATE "Lead"
        SET status = 'WAITING_FOR_APPLICATION'::\"LeadStatus\"
        WHERE status = 'CALL_COMPLETED'
      `;

      console.log(`✅ Migrated ${result} leads from CALL_COMPLETED → WAITING_FOR_APPLICATION\n`);
    }

    // Step 4: Verify migration
    console.log('🔍 Step 3: Verifying migration...');
    const remainingCallCompleted = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Lead"
      WHERE status = 'CALL_COMPLETED'
    `;
    const remaining = Number(remainingCallCompleted[0].count);

    if (remaining > 0) {
      throw new Error(`❌ Migration verification failed: ${remaining} leads still have CALL_COMPLETED status`);
    }

    const waitingCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Lead"
      WHERE status = 'WAITING_FOR_APPLICATION'
    `;
    const waiting = Number(waitingCount[0].count);

    console.log(`✅ Verification passed:`);
    console.log(`   - CALL_COMPLETED leads: ${remaining}`);
    console.log(`   - WAITING_FOR_APPLICATION leads: ${waiting}\n`);

    // Step 5: Remove CALL_COMPLETED from enum (PostgreSQL doesn't support this directly)
    console.log('⚠️  Step 4: Removing CALL_COMPLETED from enum...');
    console.log('⚠️  NOTE: PostgreSQL does not support removing enum values directly.');
    console.log('⚠️  The old CALL_COMPLETED value will remain in the database enum,');
    console.log('⚠️  but it is no longer used in the Prisma schema or application code.');
    console.log('⚠️  This is safe and will not cause issues.\n');

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log(`  - Enum updated: ✅`);
    console.log(`  - Leads migrated: ${count}`);
    console.log(`  - Data verified: ✅`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Run: npx prisma db push');
    console.log('  2. Verify application works correctly');
    console.log('  3. Deploy to production');
    console.log();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateCallCompletedToWaiting()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
