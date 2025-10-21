/**
 * Migrate all non-autonomous leads to Autonomous Holly
 *
 * This fixes leads created before we added managedByAutonomous: true to the webhook
 */

import { prisma } from '../lib/db';

async function migrateToAutonomous() {
  console.log('Finding leads not managed by Autonomous Holly...\n');

  const nonAutonomousLeads = await prisma.lead.findMany({
    where: {
      managedByAutonomous: false,
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] }, // Only active leads
      consentSms: true, // Only leads we can message
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${nonAutonomousLeads.length} leads to migrate\n`);

  if (nonAutonomousLeads.length === 0) {
    console.log('✅ All leads already using Autonomous Holly!');
    return;
  }

  console.log('Leads to migrate:');
  nonAutonomousLeads.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.status}) - created ${lead.createdAt.toLocaleDateString()}`);
  });

  console.log('\n🔄 Migrating leads to Autonomous Holly...\n');

  for (const lead of nonAutonomousLeads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        managedByAutonomous: true,
        nextReviewAt: null, // Trigger immediate autonomous review
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'NOTE_ADDED',
        channel: 'SYSTEM',
        content: 'Migrated to Autonomous Holly agent - now using AI-powered nurturing with safety guardrails',
      },
    });

    console.log(`✅ Migrated: ${lead.firstName} ${lead.lastName}`);
  }

  console.log(`\n✅ Successfully migrated ${nonAutonomousLeads.length} leads to Autonomous Holly!`);
  console.log('\nThese leads will now be reviewed by the autonomous agent on the next cron cycle (every 15 min).');
}

migrateToAutonomous()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
