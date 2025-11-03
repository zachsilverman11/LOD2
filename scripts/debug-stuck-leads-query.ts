/**
 * Debug why stuck leads aren't being picked up by autonomous agent query
 */

import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function debugQuery() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  console.log('Current time:', now.toISOString());
  console.log('Five minutes ago:', fiveMinutesAgo.toISOString());
  console.log('');

  // Run the EXACT query from autonomous-agent.ts
  const leadsToReview = await prisma.lead.findMany({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      consentSms: true,
      managedByAutonomous: true,
      hollyDisabled: false,
      OR: [
        {
          AND: [
            { nextReviewAt: null }, // Never reviewed
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: fiveMinutesAgo } },
              ],
            },
          ],
        },
        {
          AND: [
            { nextReviewAt: { lte: now } }, // Review time passed
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: fiveMinutesAgo } },
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
      status: true,
      nextReviewAt: true,
      lastContactedAt: true,
      createdAt: true,
    },
    orderBy: { nextReviewAt: 'asc' },
    take: 20,
  });

  console.log(`Found ${leadsToReview.length} leads due for review:`);
  console.log('');

  for (const lead of leadsToReview) {
    console.log(`${lead.firstName} ${lead.lastName}:`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Created: ${lead.createdAt.toISOString()}`);
    console.log(`  Next Review: ${lead.nextReviewAt ? lead.nextReviewAt.toISOString() : 'null'}`);
    console.log(`  Last Contacted: ${lead.lastContactedAt ? lead.lastContactedAt.toISOString() : 'null'}`);
    console.log('');
  }

  // Also check the 3 specific stuck leads
  const stuckLeadIds = [
    'cmha3f64h0001l204te25ep8v', // Derek
    'cmh8pt52i000ll2044vg9ixaw', // Katarzyna
    'cmh5wts330001ju04dphv2yom', // Abhishek
  ];

  console.log('Checking stuck leads specifically:');
  console.log('');

  for (const id of stuckLeadIds) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        nextReviewAt: true,
        lastContactedAt: true,
        createdAt: true,
        managedByAutonomous: true,
        hollyDisabled: true,
        consentSms: true,
      },
    });

    if (lead) {
      console.log(`${lead.firstName} ${lead.lastName}:`);
      console.log(`  Status: ${lead.status}`);
      console.log(`  managedByAutonomous: ${lead.managedByAutonomous}`);
      console.log(`  hollyDisabled: ${lead.hollyDisabled}`);
      console.log(`  consentSms: ${lead.consentSms}`);
      console.log(`  nextReviewAt: ${lead.nextReviewAt ? lead.nextReviewAt.toISOString() : 'null'}`);
      console.log(`  lastContactedAt: ${lead.lastContactedAt ? lead.lastContactedAt.toISOString() : 'null'}`);

      const isOverdue = lead.nextReviewAt && lead.nextReviewAt.getTime() < now.getTime();
      console.log(`  Is overdue? ${isOverdue}`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

debugQuery().catch(console.error);
