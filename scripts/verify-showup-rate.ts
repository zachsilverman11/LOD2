import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function verifyShowUpRate() {
  console.log('\n📊 Show-Up Rate Verification\n');
  console.log('='.repeat(80));

  // Current calculation from overview API
  const callsScheduled = await prisma.appointment.count({
    where: {
      status: {
        in: ["scheduled", "completed", "no_show"],
      },
    },
  });

  const callsCompleted = await prisma.callOutcome.count({
    where: {
      reached: true,
    },
  });

  console.log('\n🔢 Current Analytics Calculation:');
  console.log(`Calls Scheduled (appointments): ${callsScheduled}`);
  console.log(`Calls Completed (CallOutcome.reached=true): ${callsCompleted}`);
  console.log(`Show-Up Rate: ${callsScheduled > 0 ? ((callsCompleted / callsScheduled) * 100).toFixed(2) : 0}%`);

  // Get all appointments
  const appointments = await prisma.appointment.findMany({
    include: {
      lead: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    },
    orderBy: { scheduledAt: 'desc' }
  });

  console.log('\n\n📅 All Appointments:');
  console.log(`\nTotal: ${appointments.length}`);
  console.log(`Scheduled: ${appointments.filter(a => a.status === 'scheduled').length}`);
  console.log(`Completed: ${appointments.filter(a => a.status === 'completed').length}`);
  console.log(`No-Show: ${appointments.filter(a => a.status === 'no_show').length}`);
  console.log(`Cancelled: ${appointments.filter(a => a.status === 'cancelled').length}`);

  // Check which appointments have CallOutcomes
  const appointmentsWithOutcomes = [];
  const appointmentsWithoutOutcomes = [];

  for (const appt of appointments) {
    const callOutcome = await prisma.callOutcome.findFirst({
      where: {
        leadId: appt.leadId,
        reached: true,
      }
    });

    if (callOutcome) {
      appointmentsWithOutcomes.push({ appt, callOutcome });
    } else {
      appointmentsWithoutOutcomes.push(appt);
    }
  }

  console.log('\n\n✅ Appointments WITH CallOutcome (advisor reached lead):');
  console.log(`Count: ${appointmentsWithOutcomes.length}\n`);
  appointmentsWithOutcomes.forEach(({ appt, callOutcome }) => {
    console.log(`${appt.lead.firstName} ${appt.lead.lastName}`);
    console.log(`  Appointment: ${appt.scheduledAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })} - ${appt.status.toUpperCase()}`);
    console.log(`  CallOutcome: ${callOutcome.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })} - ${callOutcome.outcome}`);
    console.log('');
  });

  console.log('\n❌ Appointments WITHOUT CallOutcome:');
  console.log(`Count: ${appointmentsWithoutOutcomes.length}\n`);
  appointmentsWithoutOutcomes.forEach(appt => {
    console.log(`${appt.lead.firstName} ${appt.lead.lastName}`);
    console.log(`  Status: ${appt.status.toUpperCase()}`);
    console.log(`  Scheduled: ${appt.scheduledAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log('');
  });

  console.log('\n\n🎯 PROPOSED SHOW-UP RATE CALCULATION:');
  console.log(`\nOption 1 (Current): CallOutcomes / Appointments`);
  console.log(`  ${callsCompleted} / ${callsScheduled} = ${((callsCompleted / callsScheduled) * 100).toFixed(1)}%`);

  const pastAppointments = appointments.filter(a => {
    const now = new Date();
    return a.scheduledAt < now && a.status !== 'cancelled';
  });

  console.log(`\nOption 2 (Better): Appointments WITH CallOutcome / Past Non-Cancelled Appointments`);
  console.log(`  ${appointmentsWithOutcomes.length} / ${pastAppointments.length} = ${pastAppointments.length > 0 ? ((appointmentsWithOutcomes.length / pastAppointments.length) * 100).toFixed(1) : 0}%`);

  console.log(`\n🤔 Greg says "100% of calls showed up"`);
  console.log(`This likely means: ${pastAppointments.length} past appointments, ${appointmentsWithOutcomes.length} had calls completed`);

  await prisma.$disconnect();
}

verifyShowUpRate().catch(console.error).finally(() => process.exit(0));
