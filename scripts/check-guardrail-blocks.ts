/**
 * Check recent guardrail blocks to understand what Holly tried to say
 */

import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkGuardrailBlocks() {
  const leadIds = [
    'cmh3qgeab000fld049xho7q5m',
    'cmh855ddw0001ib04ugy09oij',
  ];

  console.log('Checking guardrail blocks for leads...\n');

  for (const leadId of leadIds) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (!lead) {
      console.log(`Lead ${leadId} not found`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${lead.firstName} ${lead.lastName} (${lead.phone})`);
    console.log(`${'='.repeat(60)}\n`);

    // Get recent guardrail blocks
    const guardrailBlocks = await prisma.leadActivity.findMany({
      where: {
        leadId: lead.id,
        type: 'NOTE_ADDED',
        channel: 'SYSTEM',
        content: { contains: 'Holly Blocked by Safety Guardrails' },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (guardrailBlocks.length === 0) {
      console.log('No recent guardrail blocks found.');
      continue;
    }

    console.log(`Found ${guardrailBlocks.length} recent guardrail block(s):\n`);

    for (const block of guardrailBlocks) {
      console.log(`Blocked at: ${block.createdAt.toISOString()}`);
      console.log(`\n${block.content}\n`);
      console.log('-'.repeat(60));
    }

    // Get recent conversation
    const recentMessages = await prisma.communication.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        createdAt: true,
        direction: true,
        content: true,
      },
    });

    console.log('\nRecent conversation:');
    for (const msg of recentMessages.reverse()) {
      const from = msg.direction === 'OUTBOUND' ? 'Holly' : lead.firstName;
      console.log(`\n[${msg.createdAt.toISOString()}] ${from}:`);
      console.log(msg.content);
    }
  }

  await prisma.$disconnect();
}

checkGuardrailBlocks().catch(console.error);
