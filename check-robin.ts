import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function checkRobinSindia() {
  // Find Robin Sindia
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Robin', mode: 'insensitive' } },
        { lastName: { contains: 'Sindia', mode: 'insensitive' } },
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'asc' }
      },
      activities: {
        orderBy: { createdAt: 'asc' }
      },
      appointments: true
    }
  });

  if (!lead) {
    console.log('Lead not found');
    return;
  }

  console.log('\n=== ROBIN SINDIA LEAD ANALYSIS ===\n');
  console.log('Lead ID:', lead.id);
  console.log('Name:', lead.firstName, lead.lastName);
  console.log('Status:', lead.status);
  console.log('Created:', lead.createdAt.toISOString());
  console.log('Source:', lead.source);

  console.log('\n=== COMMUNICATIONS (Chronological) ===');
  lead.communications.forEach((comm, i) => {
    console.log(`\n${i + 1}. [${comm.createdAt.toISOString()}]`);
    console.log('   Direction:', comm.direction);
    console.log('   Channel:', comm.channel);
    console.log('   Content:', comm.content?.substring(0, 100));
  });

  console.log('\n=== APPOINTMENTS ===');
  lead.appointments.forEach((apt) => {
    console.log('\nAppointment:', apt.id);
    console.log('Scheduled:', apt.scheduledFor?.toISOString() || apt.scheduledAt.toISOString());
    console.log('Status:', apt.status);
    console.log('Cal.com UID:', apt.calComBookingUid);
    console.log('Advisor:', apt.advisorName);
  });

  console.log('\n=== KEY ACTIVITIES ===');
  const keyActivities = lead.activities.filter(a =>
    ['WEBHOOK_RECEIVED', 'APPOINTMENT_BOOKED', 'SMS_SENT', 'SMS_RECEIVED', 'STATUS_CHANGE'].includes(a.type)
  );
  keyActivities.forEach((act) => {
    console.log(`\n[${act.createdAt.toISOString()}] ${act.type}`);
    console.log('Content:', act.content?.substring(0, 100));
  });

  console.log('\n=== ANALYSIS ===');
  const outboundSMS = lead.communications.filter(c => c.direction === 'OUTBOUND' && c.channel === 'SMS');
  const inboundSMS = lead.communications.filter(c => c.direction === 'INBOUND' && c.channel === 'SMS');

  console.log('Outbound SMS sent:', outboundSMS.length);
  console.log('Inbound SMS received:', inboundSMS.length);
  console.log('Has appointment:', lead.appointments.length > 0);

  if (outboundSMS.length > 0 && inboundSMS.length === 0 && lead.appointments.length > 0) {
    console.log('\n✅ CONFIRMED: Lead booked directly via LOD calendar link');
    console.log('   - Holly sent initial text');
    console.log('   - Lead never responded via SMS');
    console.log('   - Lead booked appointment directly through Cal.com link from LOD');
  }

  await prisma.$disconnect();
}

checkRobinSindia().catch(console.error);
