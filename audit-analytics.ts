import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function auditAnalytics() {
  console.log('\n=== ANALYTICS AUDIT ===\n');

  // Get all leads
  const allLeads = await prisma.lead.findMany({
    include: {
      communications: true,
      appointments: true,
    }
  });

  console.log('TOTAL LEADS:', allLeads.length);

  // Status breakdown
  const statusBreakdown = allLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n=== STATUS BREAKDOWN ===');
  Object.entries(statusBreakdown).forEach(([status, count]) => {
    console.log(`${status}: ${count}`);
  });

  // Check funnel logic
  console.log('\n=== FUNNEL ANALYSIS ===');

  const contacted = allLeads.filter(l => l.status !== 'NEW').length;
  const engaged = allLeads.filter(l => ['ENGAGED', 'NURTURING'].includes(l.status)).length;
  const callScheduled = allLeads.filter(l => l.status === 'CALL_SCHEDULED').length;
  const callCompleted = allLeads.filter(l => l.status === 'CALL_COMPLETED').length;
  const converted = allLeads.filter(l => l.status === 'CONVERTED').length;

  console.log('NEW leads:', statusBreakdown['NEW'] || 0);
  console.log('CONTACTED (not NEW):', contacted);
  console.log('ENGAGED:', engaged);
  console.log('CALL_SCHEDULED:', callScheduled);
  console.log('CALL_COMPLETED:', callCompleted);
  console.log('CONVERTED:', converted);

  // Check communication data
  console.log('\n=== COMMUNICATION ANALYSIS ===');
  const leadsWithOutbound = allLeads.filter(l => l.communications.some(c => c.direction === 'OUTBOUND')).length;
  const leadsWithInbound = allLeads.filter(l => l.communications.some(c => c.direction === 'INBOUND')).length;

  console.log('Leads with outbound messages:', leadsWithOutbound);
  console.log('Leads with inbound messages:', leadsWithInbound);
  console.log('Response rate:', allLeads.length > 0 ? ((leadsWithInbound / allLeads.length) * 100).toFixed(2) + '%' : '0%');

  // Check appointments
  console.log('\n=== APPOINTMENT ANALYSIS ===');
  const totalAppointments = await prisma.appointment.count();
  const leadsWithAppointments = allLeads.filter(l => l.appointments.length > 0).length;

  console.log('Total appointments:', totalAppointments);
  console.log('Leads with appointments:', leadsWithAppointments);

  // Direct booking analysis
  console.log('\n=== DIRECT BOOKING ANALYSIS ===');
  const directBookings = allLeads.filter((lead) => {
    if (lead.appointments.length === 0) return false;
    const firstAppointment = lead.appointments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const timeDiff = firstAppointment.createdAt.getTime() - lead.createdAt.getTime();
    return timeDiff < 5 * 60 * 1000 && firstAppointment.calComBookingUid;
  });

  console.log('Direct bookings:', directBookings.length);
  console.log('Direct booking rate:', allLeads.length > 0 ? ((directBookings.length / allLeads.length) * 100).toFixed(2) + '%' : '0%');

  // Problem areas
  console.log('\n=== POTENTIAL ISSUES ===');

  // Issue 1: Leads in CALL_SCHEDULED but no appointment
  const callScheduledNoAppt = allLeads.filter(l => l.status === 'CALL_SCHEDULED' && l.appointments.length === 0);
  if (callScheduledNoAppt.length > 0) {
    console.log('❌ Leads in CALL_SCHEDULED with no appointment:', callScheduledNoAppt.length);
  }

  // Issue 2: Leads with appointments but not in CALL_SCHEDULED
  const hasApptWrongStatus = allLeads.filter(l =>
    l.appointments.length > 0 &&
    !['CALL_SCHEDULED', 'CALL_COMPLETED', 'CONVERTED', 'DEALS_WON'].includes(l.status)
  );
  if (hasApptWrongStatus.length > 0) {
    console.log('❌ Leads with appointments but wrong status:', hasApptWrongStatus.length);
    hasApptWrongStatus.forEach(l => {
      console.log(`   - ${l.firstName} ${l.lastName}: ${l.status}`);
    });
  }

  // Issue 3: Conversion rate calculation
  const totalLeads = allLeads.length;
  const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(2) : '0';
  console.log('\nConversion rate calculation:', conversionRate + '%');
  console.log('(', converted, 'converted /', totalLeads, 'total )');

  // Issue 4: Funnel conversion rates
  console.log('\n=== FUNNEL CONVERSION RATES ===');
  const contactRate = statusBreakdown['NEW'] > 0 ? ((contacted / statusBreakdown['NEW']) * 100).toFixed(2) : '0';
  const engagementRate = contacted > 0 ? ((engaged / contacted) * 100).toFixed(2) : '0';
  const bookingRate = engaged > 0 ? ((callScheduled / engaged) * 100).toFixed(2) : '0';

  console.log('Contact rate (contacted/new):', contactRate + '%');
  console.log('Engagement rate (engaged/contacted):', engagementRate + '%');
  console.log('Booking rate (scheduled/engaged):', bookingRate + '%');

  await prisma.$disconnect();
}

auditAnalytics().catch(console.error);
