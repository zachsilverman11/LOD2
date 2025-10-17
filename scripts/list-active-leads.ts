/**
 * List Active Leads for Testing
 *
 * Shows active leads grouped by status to help you choose test leads
 *
 * Usage:
 *   npx tsx scripts/list-active-leads.ts
 */

import { prisma } from '../lib/db';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                      ACTIVE LEADS LIST                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const activeLeads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      consentSms: true,
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by status
  const grouped = new Map<string, typeof activeLeads>();

  activeLeads.forEach((lead) => {
    if (!grouped.has(lead.status)) {
      grouped.set(lead.status, []);
    }
    grouped.get(lead.status)!.push(lead);
  });

  // Display by status
  const statusOrder = ['NEW', 'CONTACTED', 'ENGAGED', 'CALL_SCHEDULED', 'CALL_COMPLETED', 'APPLICATION_STARTED', 'NURTURING'];

  statusOrder.forEach((status) => {
    const leads = grouped.get(status) || [];
    if (leads.length === 0) return;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`${status} (${leads.length} leads)`);
    console.log('='.repeat(70));

    leads.forEach((lead) => {
      const lastMsg = lead.communications[0];
      const lastMsgPreview = lastMsg
        ? `${lastMsg.direction === 'OUTBOUND' ? '→' : '←'} ${lastMsg.content.substring(0, 40)}...`
        : 'No messages yet';

      const hoursSinceContact = lead.lastContactedAt
        ? Math.floor((Date.now() - lead.lastContactedAt.getTime()) / (1000 * 60 * 60))
        : null;

      console.log(`\n📧 ${lead.email}`);
      console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
      console.log(`   Last contact: ${hoursSinceContact !== null ? `${hoursSinceContact}h ago` : 'Never'}`);
      console.log(`   Last msg: ${lastMsgPreview}`);
    });
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\nTotal active leads: ${activeLeads.length}\n`);

  console.log('💡 To test specific leads, copy their emails and run:');
  console.log('   npx tsx scripts/test-autonomous-agent.ts "email1@example.com" "email2@example.com"\n');
}

main();
