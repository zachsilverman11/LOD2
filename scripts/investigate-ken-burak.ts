import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function investigate() {
  // Find Ken Burak lead
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Ken', mode: 'insensitive' } },
        { lastName: { contains: 'Burak', mode: 'insensitive' } }
      ]
    },
    include: {
      communications: { orderBy: { createdAt: 'asc' } },
      appointments: { orderBy: { scheduledAt: 'asc' } },
      callOutcomes: { orderBy: { createdAt: 'asc' } },
      activities: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!lead) {
    console.log('Lead not found');
    return;
  }

  console.log('=== LEAD INFO ===');
  console.log(JSON.stringify({
    id: lead.id,
    name: `${lead.firstName} ${lead.lastName}`,
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    hollyDisabled: lead.hollyDisabled,
    createdAt: lead.createdAt,
    convertedAt: lead.convertedAt,
    applicationStartedAt: lead.applicationStartedAt,
    applicationCompletedAt: lead.applicationCompletedAt,
    pipedriveDealId: lead.pipedriveDealId,
    lastContactedAt: lead.lastContactedAt
  }, null, 2));

  console.log('\n=== APPOINTMENTS ===');
  for (const a of lead.appointments) {
    console.log(JSON.stringify({
      id: a.id,
      scheduledAt: a.scheduledAt,
      scheduledFor: a.scheduledFor,
      status: a.status,
      advisorName: a.advisorName,
      createdAt: a.createdAt
    }, null, 2));
  }

  console.log('\n=== CALL OUTCOMES ===');
  for (const co of lead.callOutcomes) {
    console.log(JSON.stringify({
      id: co.id,
      outcome: co.outcome,
      notes: co.notes,
      createdAt: co.createdAt
    }, null, 2));
  }

  console.log('\n=== ACTIVITIES (last 30) ===');
  for (const a of lead.activities.slice(-30)) {
    console.log(JSON.stringify({
      type: a.type,
      channel: a.channel,
      content: a.content?.substring(0, 300),
      createdAt: a.createdAt
    }, null, 2));
  }

  console.log('\n=== COMMUNICATIONS (SMS messages) ===');
  for (const c of lead.communications) {
    console.log(JSON.stringify({
      id: c.id,
      channel: c.channel,
      direction: c.direction,
      content: c.content?.substring(0, 300),
      createdAt: c.createdAt
    }, null, 2));
  }

  await prisma.$disconnect();
}

investigate().catch(console.error);
