import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function checkCIAppointments() {
  const lead = await prisma.lead.findFirst({
    where: {
      email: { equals: 'irwin_c@hotmail.com', mode: 'insensitive' }
    },
    include: {
      appointments: {
        orderBy: { createdAt: 'desc' }
      },
      activities: {
        where: {
          type: 'APPOINTMENT_BOOKED'
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!lead) {
    console.log('Lead not found');
    return;
  }

  console.log('\n📋 C I - Appointment Investigation\n');
  console.log('👤 ' + lead.firstName + ' ' + lead.lastName);
  console.log('📊 Current Status: ' + lead.status);
  console.log('📅 Created: ' + lead.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));

  console.log('\n📅 APPOINTMENTS:');
  if (lead.appointments.length === 0) {
    console.log('  ❌ NO APPOINTMENTS FOUND');
  } else {
    lead.appointments.forEach((appt: any) => {
      console.log('\n  Appointment ID: ' + appt.id);
      console.log('  Status: ' + appt.status);
      console.log('  Scheduled For: ' + appt.scheduledAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
      console.log('  Created: ' + appt.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
      console.log('  Advisor: ' + (appt.advisorEmail || 'N/A'));
      console.log('  Cal.com ID: ' + (appt.calcomId || 'N/A'));
    });
  }

  console.log('\n📌 APPOINTMENT ACTIVITIES:');
  if (lead.activities.length === 0) {
    console.log('  ❌ NO APPOINTMENT ACTIVITIES');
  } else {
    lead.activities.forEach((activity: any) => {
      console.log('\n  ' + activity.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
      console.log('  ' + activity.content);
    });
  }

  await prisma.$disconnect();
}

checkCIAppointments().catch(console.error).finally(() => process.exit(0));
