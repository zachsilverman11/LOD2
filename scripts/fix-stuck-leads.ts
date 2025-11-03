/**
 * Find and fix leads stuck in NEW status due to timezone bug
 * These leads came in after hours and were never contacted
 */

import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function fixStuckLeads() {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  console.log('Current time:', now.toISOString());
  console.log('Looking for leads created since:', fiveDaysAgo.toISOString());
  console.log('');

  // Find leads stuck in NEW status that:
  // 1. Were created in last 5 days
  // 2. Are managed by autonomous agent
  // 3. Have SMS consent
  // 4. Have never been contacted OR haven't been contacted recently
  // 5. Are in NEW status (the most common stuck state)
  const stuckLeads = await prisma.lead.findMany({
    where: {
      status: 'NEW',
      createdAt: { gte: fiveDaysAgo },
      managedByAutonomous: true,
      consentSms: true,
      hollyDisabled: false,
      OR: [
        { lastContactedAt: null }, // Never contacted
        { lastContactedAt: { lte: fiveDaysAgo } }, // Last contacted over 5 days ago
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
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${stuckLeads.length} stuck leads:\n`);

  if (stuckLeads.length === 0) {
    console.log('No stuck leads found. System is working correctly! ✅');
    await prisma.$disconnect();
    return;
  }

  // Display the stuck leads
  for (const lead of stuckLeads) {
    const rawData = lead.rawData as any;
    const province = rawData?.province || 'Unknown';
    const daysSinceCreated = Math.floor(
      (now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log(`${lead.firstName} ${lead.lastName} (${province}):`);
    console.log(`  Phone: ${lead.phone}`);
    console.log(`  Created: ${lead.createdAt.toISOString()} (${daysSinceCreated} days ago)`);
    console.log(`  Last Contacted: ${lead.lastContactedAt?.toISOString() || 'NEVER'}`);
    console.log(`  Next Review: ${lead.nextReviewAt?.toISOString() || 'null'}`);
    console.log('');
  }

  // Ask for confirmation
  console.log('─────────────────────────────────────────────────────');
  console.log(`Ready to fix ${stuckLeads.length} stuck leads by:`);
  console.log('1. Setting nextReviewAt to NOW (triggers immediate review)');
  console.log('2. Holly will see days-old creation date and contextualize appropriately');
  console.log('');
  console.log('Run with FIX=true to apply changes:');
  console.log('FIX=true npx tsx scripts/fix-stuck-leads.ts');
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

      console.log(`✅ Fixed ${lead.firstName} ${lead.lastName} - next review set to NOW`);
    }

    console.log(`\n🎉 Successfully updated ${stuckLeads.length} leads!`);
    console.log('The autonomous agent will pick them up in the next cycle.');
    console.log('Holly will see they were created days ago and adjust her message accordingly.');
  }

  await prisma.$disconnect();
}

fixStuckLeads().catch(console.error);
