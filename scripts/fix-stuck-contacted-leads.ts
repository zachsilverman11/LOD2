/**
 * Fix leads stuck in CONTACTED that have actually replied
 * Move them to ENGAGED so they're in the correct stage
 */

import { prisma } from '../lib/db';

async function fixStuckLeads() {
  console.log('🔧 Fixing leads stuck in CONTACTED who have replied...\n');

  // Find all leads in CONTACTED status
  const contactedLeads = await prisma.lead.findMany({
    where: {
      status: 'CONTACTED',
    },
    include: {
      communications: {
        where: {
          direction: 'INBOUND',
        },
        take: 1,
      },
    },
  });

  console.log(`Found ${contactedLeads.length} leads in CONTACTED status\n`);

  // Filter to those who have replied
  const stuckLeads = contactedLeads.filter(lead => lead.communications.length > 0);

  console.log(`${stuckLeads.length} of them have replied and should be ENGAGED:\n`);

  for (const lead of stuckLeads) {
    console.log(`📌 ${lead.firstName} ${lead.lastName}`);

    // Update to ENGAGED
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'ENGAGED' },
    });

    // Log the status change
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        channel: 'SYSTEM',
        content: 'Lead status changed from CONTACTED to ENGAGED (replied to message)',
        metadata: { automatedFix: true },
      },
    });

    console.log(`   ✅ Moved to ENGAGED\n`);
  }

  console.log(`\n✅ Fixed ${stuckLeads.length} leads!`);
}

fixStuckLeads()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
