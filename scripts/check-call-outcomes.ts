import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

async function checkCallOutcomes() {
  console.log("\n🔍 Checking call outcome data for Carol-Ann Lawson and Robert Graham...\n");

  // Find Carol-Ann Lawson
  const carolAnn = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Carol", mode: 'insensitive' } },
        { lastName: { contains: "Lawson", mode: 'insensitive' } }
      ]
    },
    include: {
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 3
      },
      appointments: {
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });

  if (carolAnn) {
    console.log("📋 CAROL-ANN LAWSON:");
    console.log(`   Lead ID: ${carolAnn.id}`);
    console.log(`   Status: ${carolAnn.status}`);
    console.log(`   Call Outcomes: ${carolAnn.callOutcomes.length} found`);

    if (carolAnn.callOutcomes.length > 0) {
      const outcome = carolAnn.callOutcomes[0];
      console.log(`\n   Latest Call Outcome:`);
      console.log(`   - Date: ${outcome.createdAt}`);
      console.log(`   - Advisor: ${outcome.advisorName}`);
      console.log(`   - Result: ${outcome.outcome}`);
      console.log(`   - Reached: ${outcome.reached}`);
      console.log(`   - Notes: ${outcome.notes || 'N/A'}`);
      console.log(`   - Appointment ID: ${outcome.appointmentId || 'N/A'}`);
    }

    console.log(`\n   Appointments: ${carolAnn.appointments.length} found`);
    if (carolAnn.appointments.length > 0) {
      carolAnn.appointments.forEach((appt, i) => {
        const date = appt.scheduledFor || appt.scheduledAt;
        console.log(`   ${i + 1}. ${appt.status} - ${date}`);
      });
    }
  }

  // Find Robert Graham
  const robert = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Robert", mode: 'insensitive' } },
        { lastName: { contains: "Graham", mode: 'insensitive' } }
      ]
    },
    include: {
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 3
      },
      appointments: {
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });

  if (robert) {
    console.log("\n\n📋 ROBERT GRAHAM:");
    console.log(`   Lead ID: ${robert.id}`);
    console.log(`   Status: ${robert.status}`);
    console.log(`   Call Outcomes: ${robert.callOutcomes.length} found`);

    if (robert.callOutcomes.length > 0) {
      const outcome = robert.callOutcomes[0];
      console.log(`\n   Latest Call Outcome:`);
      console.log(`   - Date: ${outcome.createdAt}`);
      console.log(`   - Advisor: ${outcome.advisorName}`);
      console.log(`   - Result: ${outcome.outcome}`);
      console.log(`   - Reached: ${outcome.reached}`);
      console.log(`   - Notes: ${outcome.notes || 'N/A'}`);
      console.log(`   - Appointment ID: ${outcome.appointmentId || 'N/A'}`);
    }

    console.log(`\n   Appointments: ${robert.appointments.length} found`);
    if (robert.appointments.length > 0) {
      robert.appointments.forEach((appt, i) => {
        const date = appt.scheduledFor || appt.scheduledAt;
        console.log(`   ${i + 1}. ${appt.status} - ${date}`);
      });
    }
  }

  await prisma.$disconnect();
}

checkCallOutcomes();
