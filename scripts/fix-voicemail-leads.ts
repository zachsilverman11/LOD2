/**
 * Fix leads that got NO_ANSWER call outcomes but weren't moved to NURTURING
 */

import { prisma } from '../lib/db';
import { LeadStatus } from '../app/generated/prisma';

async function fixVoicemailLeads() {
  console.log('Finding leads with NO_ANSWER outcomes not in NURTURING...\n');

  // Find all leads with NO_ANSWER call outcomes
  const noAnswerOutcomes = await prisma.callOutcome.findMany({
    where: {
      outcome: 'NO_ANSWER',
    },
    include: {
      lead: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log('Found', noAnswerOutcomes.length, 'NO_ANSWER call outcomes\n');

  const toUpdate: Array<{ id: string; name: string; currentStatus: string; callDate: Date }> = [];

  for (const outcome of noAnswerOutcomes) {
    const lead = outcome.lead;

    // Only update if they're not already in NURTURING, LOST, CONVERTED, or DEALS_WON
    if (
      lead.status !== 'NURTURING' &&
      lead.status !== 'LOST' &&
      lead.status !== 'CONVERTED' &&
      lead.status !== 'DEALS_WON'
    ) {
      // Check if this is the most recent call outcome for this lead
      const mostRecentOutcome = await prisma.callOutcome.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });

      // Only update if NO_ANSWER is the most recent outcome
      if (mostRecentOutcome?.id === outcome.id) {
        toUpdate.push({
          id: lead.id,
          name: lead.firstName + ' ' + lead.lastName,
          currentStatus: lead.status,
          callDate: outcome.createdAt,
        });
      }
    }
  }

  console.log('\nFound', toUpdate.length, 'leads to move to NURTURING:\n');

  toUpdate.forEach((lead, i) => {
    console.log((i + 1) + '.', lead.name, '(' + lead.currentStatus + ')');
    console.log('   Last NO_ANSWER call:', lead.callDate.toLocaleString() + '\n');
  });

  if (toUpdate.length === 0) {
    console.log('No leads need updating!');
    return;
  }

  console.log('\nUpdating leads to NURTURING status...\n');

  for (const lead of toUpdate) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.NURTURING },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        content: 'Status changed to NURTURING (automated fix - had NO_ANSWER call outcome)',
      },
    });

    console.log('Updated:', lead.name);
  }

  console.log('\nSuccessfully updated', toUpdate.length, 'leads to NURTURING status!');
}

fixVoicemailLeads()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
