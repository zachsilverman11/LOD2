/**
 * Reset Batch-Scheduled Leads
 *
 * 18 leads are all scheduled for the same time (8:44 AM / 15:44:31 UTC)
 * This resets them to process NOW instead of waiting
 */

import { prisma } from '../lib/db';

async function resetBatchScheduledLeads() {
  console.log('🔧 Resetting batch-scheduled leads to process NOW\n');

  const batchTime = new Date('2025-10-22T15:44:31.029Z');
  const now = new Date();

  // Find all leads with that specific time
  const batchLeads = await prisma.lead.findMany({
    where: {
      nextReviewAt: batchTime,
      managedByAutonomous: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  });

  console.log(`Found ${batchLeads.length} leads scheduled for 8:44 AM:\n`);
  batchLeads.forEach((lead, i) => {
    console.log(`  ${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.status})`);
  });

  console.log(`\nResetting their nextReviewAt to NOW...\n`);

  const result = await prisma.lead.updateMany({
    where: {
      nextReviewAt: batchTime,
      managedByAutonomous: true,
    },
    data: {
      nextReviewAt: now,
    },
  });

  console.log(`✅ Updated ${result.count} leads`);
  console.log(`\nThey will be processed in the next cron run (within 15 minutes)`);

  await prisma.$disconnect();
}

resetBatchScheduledLeads().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
