/**
 * Cohort Setup Script
 *
 * This script:
 * 1. Marks ALL existing leads as Cohort 1
 * 2. Creates the initial CohortConfig record with Cohort 2 as active
 * 3. All leads from this point forward will be assigned Cohort 2
 *
 * Run this ONCE to initialize the cohort tracking system.
 */

import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Cohort Setup...\n');

  // STEP 1: Check existing leads
  const existingLeads = await prisma.lead.findMany({
    where: {
      cohort: null, // Only leads without a cohort assigned
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      status: true,
    },
  });

  console.log(`📊 Found ${existingLeads.length} existing leads without cohort assignment`);

  if (existingLeads.length === 0) {
    console.log('✅ All leads already have cohort assignments!');
  } else {
    // Show sample of leads that will be updated
    console.log('\n📋 Sample leads to be assigned to Cohort 1:');
    existingLeads.slice(0, 5).forEach((lead) => {
      console.log(
        `   - ${lead.email} (${lead.status}) - Created: ${lead.createdAt.toLocaleDateString()}`
      );
    });
    if (existingLeads.length > 5) {
      console.log(`   ... and ${existingLeads.length - 5} more`);
    }

    // STEP 2: Get the earliest lead creation date (will be Cohort 1 start date)
    const oldestLead = existingLeads.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];

    const cohort1StartDate = oldestLead ? oldestLead.createdAt : new Date();

    console.log(`\n📅 Cohort 1 Start Date: ${cohort1StartDate.toLocaleDateString()}`);

    // STEP 3: Backfill all existing leads as Cohort 1
    console.log(`\n🔄 Updating ${existingLeads.length} leads to Cohort 1...`);

    const updateResult = await prisma.lead.updateMany({
      where: {
        cohort: null,
      },
      data: {
        cohort: 'COHORT_1',
        cohortStartDate: cohort1StartDate,
      },
    });

    console.log(`✅ Successfully assigned ${updateResult.count} leads to Cohort 1`);
  }

  // STEP 4: Create Cohort 2 config (current active cohort)
  console.log('\n🔧 Setting up Cohort 2 as active cohort...');

  // Check if cohort config already exists
  const existingConfig = await prisma.cohortConfig.findFirst();

  if (existingConfig) {
    console.log(`⚠️  CohortConfig already exists: ${existingConfig.currentCohortName}`);
    console.log('   Skipping creation. Use the admin dashboard to change cohorts.');
  } else {
    const cohort2StartDate = new Date(); // RIGHT NOW

    const cohortConfig = await prisma.cohortConfig.create({
      data: {
        currentCohortName: 'COHORT_2',
        cohortNumber: 2,
        cohortStartDate: cohort2StartDate,
      },
    });

    console.log(`✅ Created CohortConfig: ${cohortConfig.currentCohortName}`);
    console.log(`   Cohort 2 Start Date: ${cohort2StartDate.toISOString()}`);
    console.log('\n🎉 All NEW leads from this point forward will be assigned to Cohort 2');
  }

  // STEP 5: Summary
  console.log('\n' + '='.repeat(80));
  console.log('COHORT SETUP SUMMARY');
  console.log('='.repeat(80));

  const cohort1Count = await prisma.lead.count({
    where: { cohort: 'COHORT_1' },
  });

  const cohort2Count = await prisma.lead.count({
    where: { cohort: 'COHORT_2' },
  });

  const noCohortCount = await prisma.lead.count({
    where: { cohort: null },
  });

  console.log(`\nCohort 1: ${cohort1Count} leads (historical)`);
  console.log(`Cohort 2: ${cohort2Count} leads (current - started just now)`);
  console.log(`No Cohort: ${noCohortCount} leads (should be 0)`);

  const activeConfig = await prisma.cohortConfig.findFirst();
  if (activeConfig) {
    console.log(`\nActive Cohort: ${activeConfig.currentCohortName}`);
    console.log(`Started: ${activeConfig.cohortStartDate.toLocaleString()}`);
  }

  console.log('\n✅ Cohort tracking system is now active!');
  console.log('   All new leads will automatically be assigned to the current cohort.');
  console.log('   Use the admin dashboard to advance to Cohort 3 when ready.\n');
}

main()
  .catch((error) => {
    console.error('❌ Error setting up cohorts:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
