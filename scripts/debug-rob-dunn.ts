/**
 * Debug script to see exactly what Holly saw for Rob Dunn
 */

import { PrismaClient } from '../app/generated/prisma';
import { buildHollyBriefing } from '../lib/holly-knowledge-base';

const prisma = new PrismaClient();

async function debugRobDunn() {
  const lead = await prisma.lead.findFirst({
    where: {
      firstName: 'Rob',
      lastName: 'Dunn',
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      appointments: {
        orderBy: { createdAt: 'desc' },
      },
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!lead) {
    console.log('Lead not found');
    return;
  }

  console.log('\n=== ROB DUNN LEAD DATA ===\n');
  console.log('Status:', lead.status);
  console.log('Created:', lead.createdAt);
  console.log('Last Contacted:', lead.lastContactedAt);
  console.log('\n=== APPOINTMENTS ===\n');

  if (lead.appointments && lead.appointments.length > 0) {
    lead.appointments.forEach((appt, i) => {
      const scheduledDate = appt.scheduledFor || appt.scheduledAt;
      const isPast = scheduledDate < new Date();
      console.log(`\nAppointment ${i + 1}:`);
      console.log(`  Scheduled for: ${scheduledDate}`);
      console.log(`  Status: ${appt.status}`);
      console.log(`  Advisor: ${appt.advisorName}`);
      console.log(`  Is Past: ${isPast ? 'YES ✅' : 'NO - UPCOMING'}`);
      console.log(`  Days from now: ${Math.round((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`);
    });
  }

  console.log('\n=== WHAT HOLLY SAW (BRIEFING) ===\n');

  const briefing = buildHollyBriefing({
    leadData: lead,
    conversationContext: {
      touchNumber: 3,
      lastMessageFrom: 'lead' as const,
      daysInPipeline: Math.floor((Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    },
    appointments: lead.appointments,
    callOutcome: lead.callOutcomes?.[0] || null,
    applicationStatus: {
      started: lead.applicationStartedAt,
      completed: lead.applicationCompletedAt,
    },
  });

  console.log(briefing);

  await prisma.$disconnect();
}

debugRobDunn();
