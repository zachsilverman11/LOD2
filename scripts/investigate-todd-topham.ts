import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

async function investigateToddTopham() {
  console.log("\n🔍 Investigating Todd Topham lead...\n");

  // Find Todd Topham
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Todd", mode: 'insensitive' } },
        { lastName: { contains: "Topham", mode: 'insensitive' } }
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      appointments: {
        orderBy: { createdAt: 'desc' },
      },
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30
      }
    }
  });

  if (!lead) {
    console.log("❌ Todd Topham not found");
    return;
  }

  console.log("📋 TODD TOPHAM DETAILS:");
  console.log(`   Lead ID: ${lead.id}`);
  console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
  console.log(`   Phone: ${lead.phone}`);
  console.log(`   Email: ${lead.email || 'N/A'}`);
  console.log(`   Status: ${lead.status}`);
  console.log(`   Application Started: ${lead.applicationStartedAt || 'N/A'}`);
  console.log(`   Application Completed: ${lead.applicationCompletedAt || 'N/A'}`);
  console.log(`   Created: ${lead.createdAt}`);

  console.log("\n📅 RECENT ACTIVITY (last 30):");
  lead.activities.forEach((activity, i) => {
    console.log(`   ${i + 1}. [${activity.createdAt.toISOString()}] ${activity.type}`);
    console.log(`      Subject: ${activity.subject || 'N/A'}`);
    if (activity.content) {
      const preview = activity.content.substring(0, 100);
      console.log(`      Content: ${preview}${activity.content.length > 100 ? '...' : ''}`);
    }
  });

  console.log("\n💬 RECENT COMMUNICATIONS (last 20):");
  lead.communications.forEach((comm, i) => {
    console.log(`   ${i + 1}. [${comm.createdAt.toISOString()}] ${comm.direction} ${comm.channel}`);
    const preview = comm.content?.substring(0, 80) || '';
    console.log(`      ${preview}${(comm.content?.length || 0) > 80 ? '...' : ''}`);
  });

  console.log("\n📞 APPOINTMENTS:");
  if (lead.appointments.length === 0) {
    console.log("   No appointments found");
  } else {
    lead.appointments.forEach((appt, i) => {
      const date = appt.scheduledFor || appt.scheduledAt;
      console.log(`   ${i + 1}. ${appt.status} - ${date} with ${appt.advisorName}`);
    });
  }

  console.log("\n📞 CALL OUTCOMES:");
  if (lead.callOutcomes.length === 0) {
    console.log("   No call outcomes found");
  } else {
    lead.callOutcomes.forEach((outcome, i) => {
      console.log(`   ${i + 1}. [${outcome.createdAt.toISOString()}] ${outcome.outcome} by ${outcome.advisorName}`);
      console.log(`      Reached: ${outcome.reached}`);
      console.log(`      Notes: ${outcome.notes || 'N/A'}`);
    });
  }

  // Look for activities around Nov 3-5
  console.log("\n🔍 ACTIVITIES AROUND NOV 3-5:");
  const nov3to5 = lead.activities.filter(a => {
    const date = new Date(a.createdAt);
    return date >= new Date('2025-11-03') && date <= new Date('2025-11-06');
  });

  if (nov3to5.length === 0) {
    console.log("   No activities found in this date range");
  } else {
    nov3to5.forEach((activity) => {
      console.log(`\n   [${activity.createdAt.toISOString()}] ${activity.type}`);
      console.log(`   Subject: ${activity.subject || 'N/A'}`);
      console.log(`   Content: ${activity.content || 'N/A'}`);
      if (activity.metadata) {
        console.log(`   Metadata: ${JSON.stringify(activity.metadata, null, 2)}`);
      }
    });
  }

  await prisma.$disconnect();
}

investigateToddTopham();
