/**
 * Fix leads stuck in CONTACTED that should be ENGAGED
 *
 * This fixes leads that were caught in the transition from old Holly to new Autonomous Holly.
 * They replied positively but weren't moved to ENGAGED status.
 */

import { prisma } from '../lib/db';
import { LeadStatus } from '../app/generated/prisma';

async function fixEngagedStatus() {
  console.log('🔍 Finding leads stuck in CONTACTED with positive responses...\n');

  // Find leads that:
  // 1. Are in CONTACTED status
  // 2. Have inbound (reply) messages
  // 3. Are managed by autonomous Holly
  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.CONTACTED,
      managedByAutonomous: true,
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  console.log(`Found ${leads.length} leads in CONTACTED status\n`);

  const toUpdate: Array<{ id: string; name: string; reason: string }> = [];

  for (const lead of leads) {
    const inboundMessages = lead.communications.filter((c) => c.direction === 'INBOUND');

    // If they replied, they should be ENGAGED (not CONTACTED)
    if (inboundMessages.length > 0) {
      const lastReply = inboundMessages[0];
      const replyContent = lastReply.content.toLowerCase();

      // Check if it's a positive/engaged response (not STOP/unsubscribe)
      const isOptOut = replyContent.includes('stop') || replyContent.includes('unsubscribe');
      const isNegative = replyContent.includes('not interested') || replyContent.includes('no thanks');

      if (!isOptOut && !isNegative) {
        toUpdate.push({
          id: lead.id,
          name: `${lead.firstName} ${lead.lastName}`,
          reason: `Replied: "${lastReply.content.substring(0, 50)}..."`,
        });
      }
    }
  }

  console.log(`\n📋 Found ${toUpdate.length} leads to update to ENGAGED:\n`);

  toUpdate.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.name}`);
    console.log(`   ${lead.reason}\n`);
  });

  if (toUpdate.length === 0) {
    console.log('✅ No leads need updating!');
    return;
  }

  console.log('\n🔄 Updating leads to ENGAGED status...\n');

  for (const lead of toUpdate) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.ENGAGED },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        content: `Status changed to ENGAGED (automated fix - lead had replied but was stuck in CONTACTED)`,
      },
    });

    console.log(`✅ Updated: ${lead.name}`);
  }

  console.log(`\n✅ Successfully updated ${toUpdate.length} leads to ENGAGED status!`);
}

fixEngagedStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
