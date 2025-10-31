/**
 * Find and fix ALL leads stuck without contact for days
 * Covers all statuses, not just NEW
 */

import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function fixAllStuckLeads() {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  console.log('Current time:', now.toISOString());
  console.log('');

  // Find ALL leads that should be reviewed but haven't been contacted
  // This matches the exact query from autonomous-holly cron
  const stuckLeads = await prisma.lead.findMany({
    where: {
      status: {
        notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'],
      },
      consentSms: true,
      managedByAutonomous: true,
      hollyDisabled: false,
      OR: [
        {
          // nextReviewAt is null but they should be contacted
          AND: [
            { nextReviewAt: null },
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: tenMinutesAgo } },
              ],
            },
          ],
        },
        {
          // nextReviewAt is overdue
          AND: [
            { nextReviewAt: { lte: now } },
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: tenMinutesAgo } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      lastContactedAt: true,
      nextReviewAt: true,
      rawData: true,
    },
    orderBy: { nextReviewAt: 'asc' },
  });

  console.log(`Found ${stuckLeads.length} stuck leads:\n`);

  if (stuckLeads.length === 0) {
    console.log('No stuck leads found. System is working correctly! ✅');
    await prisma.$disconnect();
    return;
  }

  // Group by status for better visibility
  const byStatus: Record<string, typeof stuckLeads> = {};
  for (const lead of stuckLeads) {
    if (!byStatus[lead.status]) {
      byStatus[lead.status] = [];
    }
    byStatus[lead.status].push(lead);
  }

  // Display the stuck leads grouped by status
  for (const [status, leads] of Object.entries(byStatus)) {
    console.log(`\n📊 ${status} (${leads.length} leads):`);
    console.log('─'.repeat(60));

    for (const lead of leads) {
      const rawData = lead.rawData as any;
      const province = rawData?.province || 'Unknown';
      const daysSinceCreated = Math.floor(
        (now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceLastContact = lead.lastContactedAt
        ? Math.floor((now.getTime() - lead.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      console.log(`\n${lead.firstName} ${lead.lastName} (${province}):`);
      console.log(`  Phone: ${lead.phone}`);
      console.log(`  Created: ${lead.createdAt.toISOString()} (${daysSinceCreated} days ago)`);
      console.log(`  Last Contacted: ${lead.lastContactedAt?.toISOString() || 'NEVER'}${daysSinceLastContact !== null ? ` (${daysSinceLastContact} days ago)` : ''}`);
      console.log(`  Next Review: ${lead.nextReviewAt?.toISOString() || 'null'}`);

      if (lead.nextReviewAt && lead.nextReviewAt < now) {
        const hoursOverdue = Math.floor((now.getTime() - lead.nextReviewAt.getTime()) / (1000 * 60 * 60));
        console.log(`  ⚠️  OVERDUE by ${hoursOverdue} hours`);
      }
    }
  }

  console.log('\n\n─────────────────────────────────────────────────────');
  console.log(`Ready to fix ${stuckLeads.length} stuck leads by:`);
  console.log('1. Setting nextReviewAt to NOW (triggers immediate review)');
  console.log('2. Holly will see the full context and send appropriate messages');
  console.log('');
  console.log('Run with FIX=true to apply changes:');
  console.log('FIX=true npx tsx scripts/fix-all-stuck-leads.ts');
  console.log('─────────────────────────────────────────────────────');

  if (process.env.FIX === 'true') {
    console.log('\nApplying fixes...\n');

    for (const lead of stuckLeads) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nextReviewAt: now, // Set to now so autonomous agent picks them up immediately
        },
      });

      console.log(`✅ Fixed ${lead.firstName} ${lead.lastName} (${lead.status}) - next review set to NOW`);
    }

    console.log(`\n🎉 Successfully updated ${stuckLeads.length} leads!`);
    console.log('The autonomous agent will pick them up in the next cycle.');
    console.log('Holly will see the full context (days since creation, last contact, etc.)');
    console.log('and will send contextually appropriate messages.');
  }

  await prisma.$disconnect();
}

fixAllStuckLeads().catch(console.error);
