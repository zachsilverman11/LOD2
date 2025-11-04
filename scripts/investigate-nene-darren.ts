/**
 * Investigation Script: Nene Eye and Darren Wright Booking Issues
 *
 * Issue 1: Nene Eye - LOD2 shows call scheduled, but no Cal.com booking exists
 * Issue 2: Darren Wright - Cal.com shows booking, but LOD2 doesn't show it
 */

import { prisma } from '../lib/db';

async function investigateBookingIssues() {
  console.log('='.repeat(80));
  console.log('INVESTIGATION: Nene Eye and Darren Wright Booking Issues');
  console.log('='.repeat(80));
  console.log();

  // ===== NENE EYE INVESTIGATION =====
  console.log('━'.repeat(80));
  console.log('ISSUE 1: Nene Eye - False Positive (shows scheduled but no Cal.com booking)');
  console.log('━'.repeat(80));
  console.log();

  const nene = await prisma.lead.findFirst({
    where: {
      OR: [
        { email: { contains: 'nene', mode: 'insensitive' } },
        { firstName: { contains: 'Nene', mode: 'insensitive' } },
        { lastName: { contains: 'Eye', mode: 'insensitive' } },
      ],
    },
    include: {
      appointments: {
        orderBy: { createdAt: 'desc' },
      },
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (nene) {
    console.log('✅ FOUND: Nene Eye');
    console.log('─'.repeat(80));
    console.log(`ID: ${nene.id}`);
    console.log(`Name: ${nene.firstName} ${nene.lastName}`);
    console.log(`Email: ${nene.email}`);
    console.log(`Phone: ${nene.phone}`);
    console.log(`Status: ${nene.status}`);
    console.log(`Created: ${nene.createdAt.toLocaleString()}`);
    console.log(`Last Contacted: ${nene.lastContactedAt?.toLocaleString() || 'Never'}`);
    console.log();

    console.log('📅 APPOINTMENTS:');
    if (nene.appointments.length === 0) {
      console.log('  ❌ NO APPOINTMENTS FOUND');
    } else {
      nene.appointments.forEach((apt, i) => {
        console.log(`  ${i + 1}. ${apt.status.toUpperCase()}`);
        console.log(`     Scheduled for: ${apt.scheduledFor.toLocaleString()}`);
        console.log(`     Created: ${apt.createdAt.toLocaleString()}`);
        console.log(`     Cal.com UID: ${apt.calComBookingUid || 'NONE'}`);
        console.log(`     Cal.com Event ID: ${apt.calComEventId || 'NONE'}`);
        console.log(`     Notes: ${apt.notes || 'None'}`);
        console.log();
      });
    }

    console.log('📱 RECENT COMMUNICATIONS (Last 10):');
    nene.communications.slice(0, 10).forEach((comm, i) => {
      console.log(`  ${i + 1}. [${comm.createdAt.toLocaleString()}] ${comm.channel} ${comm.direction}`);
      console.log(`     ${comm.content?.substring(0, 100)}${comm.content && comm.content.length > 100 ? '...' : ''}`);
    });
    console.log();

    console.log('📋 RECENT ACTIVITIES (Last 20):');
    nene.activities.slice(0, 20).forEach((act, i) => {
      console.log(`  ${i + 1}. [${act.createdAt.toLocaleString()}] ${act.type}`);
      console.log(`     Subject: ${act.subject || 'N/A'}`);
      if (act.content) {
        console.log(`     ${act.content.substring(0, 150)}${act.content.length > 150 ? '...' : ''}`);
      }
      if (act.metadata) {
        console.log(`     Metadata: ${JSON.stringify(act.metadata).substring(0, 100)}`);
      }
      console.log();
    });
  } else {
    console.log('❌ NOT FOUND: Could not find Nene Eye in database');
  }

  console.log();
  console.log('━'.repeat(80));
  console.log('ISSUE 2: Darren Wright - False Negative (Cal.com has booking, LOD2 doesn\'t)');
  console.log('━'.repeat(80));
  console.log();

  // ===== DARREN WRIGHT INVESTIGATION =====
  const darren = await prisma.lead.findFirst({
    where: {
      OR: [
        { email: { contains: 'darren', mode: 'insensitive' } },
        { firstName: { contains: 'Darren', mode: 'insensitive' } },
        { lastName: { contains: 'Wright', mode: 'insensitive' } },
      ],
    },
    include: {
      appointments: {
        orderBy: { createdAt: 'desc' },
      },
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (darren) {
    console.log('✅ FOUND: Darren Wright');
    console.log('─'.repeat(80));
    console.log(`ID: ${darren.id}`);
    console.log(`Name: ${darren.firstName} ${darren.lastName}`);
    console.log(`Email: ${darren.email}`);
    console.log(`Phone: ${darren.phone}`);
    console.log(`Status: ${darren.status}`);
    console.log(`Created: ${darren.createdAt.toLocaleString()}`);
    console.log(`Last Contacted: ${darren.lastContactedAt?.toLocaleString() || 'Never'}`);
    console.log();

    console.log('📅 APPOINTMENTS:');
    if (darren.appointments.length === 0) {
      console.log('  ❌ NO APPOINTMENTS FOUND (This is the bug!)');
    } else {
      darren.appointments.forEach((apt, i) => {
        console.log(`  ${i + 1}. ${apt.status.toUpperCase()}`);
        console.log(`     Scheduled for: ${apt.scheduledFor.toLocaleString()}`);
        console.log(`     Created: ${apt.createdAt.toLocaleString()}`);
        console.log(`     Cal.com UID: ${apt.calComBookingUid || 'NONE'}`);
        console.log(`     Cal.com Event ID: ${apt.calComEventId || 'NONE'}`);
        console.log(`     Notes: ${apt.notes || 'None'}`);
        console.log();
      });
    }

    console.log('📱 RECENT COMMUNICATIONS (Last 10):');
    darren.communications.slice(0, 10).forEach((comm, i) => {
      console.log(`  ${i + 1}. [${comm.createdAt.toLocaleString()}] ${comm.channel} ${comm.direction}`);
      console.log(`     ${comm.content?.substring(0, 100)}${comm.content && comm.content.length > 100 ? '...' : ''}`);
    });
    console.log();

    console.log('📋 RECENT ACTIVITIES (Last 20):');
    darren.activities.slice(0, 20).forEach((act, i) => {
      console.log(`  ${i + 1}. [${act.createdAt.toLocaleString()}] ${act.type}`);
      console.log(`     Subject: ${act.subject || 'N/A'}`);
      if (act.content) {
        console.log(`     ${act.content.substring(0, 150)}${act.content.length > 150 ? '...' : ''}`);
      }
      if (act.metadata) {
        console.log(`     Metadata: ${JSON.stringify(act.metadata).substring(0, 100)}`);
      }
      console.log();
    });
  } else {
    console.log('❌ NOT FOUND: Could not find Darren Wright in database');
  }

  console.log();
  console.log('━'.repeat(80));
  console.log('WEBHOOK EVENTS - Recent Cal.com webhooks');
  console.log('━'.repeat(80));
  console.log();

  // Check recent Cal.com webhook events
  const recentWebhooks = await prisma.webhookEvent.findMany({
    where: {
      source: 'cal_com',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (recentWebhooks.length === 0) {
    console.log('❌ NO Cal.com webhooks in last 7 days');
  } else {
    recentWebhooks.forEach((webhook, i) => {
      console.log(`${i + 1}. [${webhook.createdAt.toLocaleString()}] ${webhook.eventType}`);
      console.log(`   Processed: ${webhook.processed ? '✅' : '❌'}`);
      if (webhook.error) {
        console.log(`   Error: ${webhook.error}`);
      }

      // Try to extract email from payload
      const payload = webhook.payload as any;
      if (payload?.payload?.attendees?.[0]?.email) {
        console.log(`   Email: ${payload.payload.attendees[0].email}`);
      }
      if (payload?.payload?.uid) {
        console.log(`   Booking UID: ${payload.payload.uid}`);
      }
      console.log();
    });
  }

  console.log();
  console.log('━'.repeat(80));
  console.log('ORPHANED BOOKINGS - Cal.com bookings that couldn\'t find a lead');
  console.log('━'.repeat(80));
  console.log();

  const orphanedBookings = await prisma.webhookEvent.findMany({
    where: {
      source: 'cal_com',
      eventType: 'BOOKING_CREATED_ORPHAN',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (orphanedBookings.length === 0) {
    console.log('✅ No orphaned bookings found (good!)');
  } else {
    orphanedBookings.forEach((orphan, i) => {
      console.log(`${i + 1}. [${orphan.createdAt.toLocaleString()}]`);
      const payload = orphan.payload as any;
      console.log(`   Email: ${payload.attendeeEmail || 'N/A'}`);
      console.log(`   Phone: ${payload.attendeePhone || 'N/A'}`);
      console.log(`   Booking UID: ${payload.bookingUid || 'N/A'}`);
      console.log(`   Error: ${orphan.error}`);
      console.log();
    });
  }

  console.log();
  console.log('='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateBookingIssues()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
