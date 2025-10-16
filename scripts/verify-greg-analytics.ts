import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function verifyAnalytics() {
  console.log('\n📊 ANALYTICS VERIFICATION - Checking Greg\'s Concerns\n');
  console.log('='.repeat(80));

  // Get all leads
  const allLeads = await prisma.lead.findMany({
    include: {
      callOutcomes: true,
      appointments: true,
      communications: true,
    }
  });

  console.log('\n🎯 CALL OUTCOMES (What Greg is tracking):\n');

  // Get all call outcomes where reached = true
  const completedCalls = await prisma.callOutcome.findMany({
    where: {
      reached: true
    },
    include: {
      lead: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          applicationStartedAt: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total Completed Calls (reached=true): ${completedCalls.length}`);
  console.log('\nDetails:');
  completedCalls.forEach((call, i) => {
    const date = call.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
    console.log(`${i + 1}. ${call.lead.firstName} ${call.lead.lastName} (${call.lead.email})`);
    console.log(`   Date: ${date}`);
    console.log(`   Outcome: ${call.outcome}, Quality: ${call.leadQuality || 'N/A'}`);
    console.log(`   Lead Status: ${call.lead.status}`);
    console.log(`   App Started: ${call.lead.applicationStartedAt ? 'YES' : 'NO'}`);
    console.log('');
  });

  console.log('\n📱 APPLICATION TRACKING:\n');

  // Get leads with APPLICATION_STARTED status
  const appsStartedByStatus = await prisma.lead.findMany({
    where: {
      status: 'APPLICATION_STARTED'
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      applicationStartedAt: true,
      status: true,
    }
  });

  console.log(`Leads in APPLICATION_STARTED status: ${appsStartedByStatus.length}`);
  appsStartedByStatus.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`   Started At: ${lead.applicationStartedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' }) || 'NULL'}`);
  });

  // Get leads with applicationStartedAt timestamp
  const appsStartedByTimestamp = await prisma.lead.findMany({
    where: {
      applicationStartedAt: {
        not: null
      }
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      applicationStartedAt: true,
      status: true,
    }
  });

  console.log(`\nLeads with applicationStartedAt timestamp: ${appsStartedByTimestamp.length}`);
  appsStartedByTimestamp.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`   Status: ${lead.status}`);
    console.log(`   Started At: ${lead.applicationStartedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
  });

  // Get CONVERTED leads
  const convertedLeads = await prisma.lead.findMany({
    where: {
      status: 'CONVERTED'
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      applicationCompletedAt: true,
    }
  });

  console.log(`\nLeads with CONVERTED status (completed apps): ${convertedLeads.length}`);
  convertedLeads.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`   Completed At: ${lead.applicationCompletedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' }) || 'NULL'}`);
  });

  console.log('\n📅 APPOINTMENTS (Show-up tracking):\n');

  // Get all appointments
  const allAppointments = await prisma.appointment.findMany({
    include: {
      lead: {
        select: {
          firstName: true,
          lastName: true,
        }
      }
    },
    orderBy: { scheduledAt: 'desc' }
  });

  console.log(`Total Appointments: ${allAppointments.length}\n`);

  const scheduled = allAppointments.filter(a => a.status === 'scheduled');
  const completed = allAppointments.filter(a => a.status === 'completed');
  const noShow = allAppointments.filter(a => a.status === 'no_show');
  const cancelled = allAppointments.filter(a => a.status === 'cancelled');

  console.log(`Scheduled: ${scheduled.length}`);
  console.log(`Completed: ${completed.length}`);
  console.log(`No-Show: ${noShow.length}`);
  console.log(`Cancelled: ${cancelled.length}`);

  console.log('\nAll Appointments:');
  allAppointments.forEach((appt, i) => {
    const date = appt.scheduledAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
    console.log(`${i + 1}. ${appt.lead.firstName} ${appt.lead.lastName} - ${appt.status.toUpperCase()}`);
    console.log(`   Scheduled: ${date}`);
    console.log(`   Advisor: ${appt.advisorName || 'N/A'}`);
  });

  console.log('\n🔢 ANALYTICS CALCULATIONS:\n');

  const totalLeads = allLeads.length;
  const callsScheduledCount = allAppointments.filter(a =>
    a.status === 'scheduled' || a.status === 'completed' || a.status === 'no_show'
  ).length;
  const callsCompletedCount = completedCalls.length;
  const appsStartedCount = appsStartedByTimestamp.length;
  const convertedCount = convertedLeads.length;

  console.log(`Total Leads: ${totalLeads}`);
  console.log(`Calls Scheduled: ${callsScheduledCount} (scheduled + completed + no_show appointments)`);
  console.log(`Calls Completed: ${callsCompletedCount} (CallOutcome.reached = true)`);
  console.log(`Apps Started: ${appsStartedCount} (applicationStartedAt timestamp)`);
  console.log(`Apps Completed (Converted): ${convertedCount}`);

  console.log(`\nLead-to-Call Rate: ${totalLeads > 0 ? ((callsScheduledCount / totalLeads) * 100).toFixed(1) : 0}%`);
  console.log(`Show-Up Rate: ${callsScheduledCount > 0 ? ((callsCompletedCount / callsScheduledCount) * 100).toFixed(1) : 0}%`);
  console.log(`Call-to-App Rate: ${callsCompletedCount > 0 ? ((appsStartedCount / callsCompletedCount) * 100).toFixed(1) : 0}%`);
  console.log(`Lead-to-App Rate: ${totalLeads > 0 ? ((appsStartedCount / totalLeads) * 100).toFixed(1) : 0}%`);

  console.log('\n🔍 GREG\'S CLAIMS vs SYSTEM:\n');
  console.log(`Greg says: 8 completed calls`);
  console.log(`System shows: ${callsCompletedCount} completed calls (CallOutcome.reached=true)`);
  console.log(`Discrepancy: ${callsCompletedCount - 8}`);

  console.log(`\nGreg says: 3 completed applications`);
  console.log(`System shows: ${convertedCount} CONVERTED`);
  console.log(`Discrepancy: ${convertedCount - 3}`);

  console.log(`\nGreg says: 4 additional apps started (not completed)`);
  console.log(`System shows: ${appsStartedCount} with applicationStartedAt`);
  console.log(`Apps started but not converted: ${appsStartedCount - convertedCount}`);
  console.log(`Discrepancy: ${(appsStartedCount - convertedCount) - 4}`);

  await prisma.$disconnect();
}

verifyAnalytics().catch(console.error).finally(() => process.exit(0));
