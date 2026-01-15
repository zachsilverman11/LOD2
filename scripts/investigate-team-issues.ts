import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

async function investigateTeamIssues() {
  console.log("\n🔍 Investigating Team-Reported Issues...\n");
  console.log("=" .repeat(80));

  // Issue 1: Derek Wynne - Failed Slack alert + Holly disabled but still sent message
  console.log("\n📋 ISSUE 1: DEREK WYNNE");
  console.log("=" .repeat(80));

  const derek = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Derek", mode: 'insensitive' } },
        { lastName: { contains: "Wynne", mode: 'insensitive' } }
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  });

  if (derek) {
    console.log(`Name: ${derek.firstName} ${derek.lastName}`);
    console.log(`Status: ${derek.status}`);
    console.log(`Holly Disabled: ${derek.hollyDisabled}`);
    console.log(`Managed by Autonomous: ${derek.managedByAutonomous}`);

    console.log("\n📅 Recent Activities:");
    derek.activities.slice(0, 10).forEach((activity, i) => {
      console.log(`   ${i + 1}. [${activity.createdAt.toISOString()}] ${activity.type}`);
      console.log(`      Subject: ${activity.subject || 'N/A'}`);
      if (activity.subject?.includes("Failed Slack")) {
        console.log(`      Content: ${activity.content}`);
      }
    });

    console.log("\n💬 Recent Communications:");
    derek.communications.slice(0, 5).forEach((comm, i) => {
      console.log(`   ${i + 1}. [${comm.createdAt.toISOString()}] ${comm.direction} ${comm.channel}`);
      const preview = comm.content?.substring(0, 100) || '';
      console.log(`      ${preview}`);
    });
  } else {
    console.log("❌ Derek Wynne not found");
  }

  // Issue 2: Chaba - Moved from NURTURING to ENGAGED incorrectly
  console.log("\n\n📋 ISSUE 2: CHABA");
  console.log("=" .repeat(80));

  const chaba = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: "Chaba", mode: 'insensitive' } },
        { lastName: { contains: "Chaba", mode: 'insensitive' } }
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  });

  if (chaba) {
    console.log(`Name: ${chaba.firstName} ${chaba.lastName}`);
    console.log(`Status: ${chaba.status}`);
    console.log(`Holly Disabled: ${chaba.hollyDisabled}`);

    console.log("\n📅 Recent Activities (looking for status changes):");
    chaba.activities.forEach((activity, i) => {
      if (activity.type === 'STATUS_CHANGE' || activity.subject?.includes("Failed Slack") || activity.content?.includes("NURTURING") || activity.content?.includes("ENGAGED")) {
        console.log(`   ${i + 1}. [${activity.createdAt.toISOString()}] ${activity.type}`);
        console.log(`      Subject: ${activity.subject || 'N/A'}`);
        console.log(`      Content: ${activity.content?.substring(0, 200) || 'N/A'}`);
      }
    });

    console.log("\n💬 Recent Communications:");
    chaba.communications.slice(0, 5).forEach((comm, i) => {
      console.log(`   ${i + 1}. [${comm.createdAt.toISOString()}] ${comm.direction} ${comm.channel}`);
      const preview = comm.content?.substring(0, 150) || '';
      console.log(`      ${preview}`);
    });
  } else {
    console.log("❌ Chaba not found");
  }

  // Issue 3: Todd Topham - We already investigated but let's check the failed slack alert detail
  console.log("\n\n📋 ISSUE 3: TODD TOPHAM (RECAP)");
  console.log("=" .repeat(80));

  const todd = await prisma.lead.findFirst({
    where: {
      firstName: { contains: "Todd", mode: 'insensitive' },
      lastName: { contains: "Topham", mode: 'insensitive' }
    },
    include: {
      activities: {
        where: {
          subject: { contains: "Failed Slack", mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (todd && todd.activities.length > 0) {
    const failedAlert = todd.activities[0];
    console.log(`Failed Slack Alert Date: ${failedAlert.createdAt.toISOString()}`);
    console.log(`Subject: ${failedAlert.subject}`);
    console.log(`Full Content:\n${failedAlert.content}`);
    if (failedAlert.metadata) {
      console.log(`Metadata: ${JSON.stringify(failedAlert.metadata, null, 2)}`);
    }
  }

  await prisma.$disconnect();
}

investigateTeamIssues();
