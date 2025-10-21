import { prisma } from '../lib/db';

async function investigateGillian() {
  console.log("🔍 Investigating Gillian Lindsay...\n");

  // Get Gillian's lead data
  const gillian = await prisma.lead.findFirst({
    where: {
      firstName: "Gillian",
      lastName: "Lindsay",
    },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      communications: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!gillian) {
    console.log("❌ Gillian Lindsay not found");
    return;
  }

  console.log("📊 Lead Data:");
  console.log(`  Name: ${gillian.firstName} ${gillian.lastName}`);
  console.log(`  Status: ${gillian.status}`);
  console.log(`  Managed by Autonomous: ${gillian.managedByAutonomous}`);
  console.log(`  Created: ${gillian.createdAt}`);
  console.log(`  Last Contacted: ${gillian.lastContactedAt}`);
  console.log(`  Next Review: ${gillian.nextReviewAt}`);
  console.log(`  Phone: ${gillian.phone}`);
  console.log(`  Email: ${gillian.email}`);
  console.log("");

  console.log("💬 Recent Activities (last 20):");
  gillian.activities.forEach((activity, index) => {
    console.log(`\n${index + 1}. ${activity.type} (${activity.channel}) - ${activity.createdAt}`);
    console.log(`   Content: ${activity.content?.substring(0, 200)}${activity.content && activity.content.length > 200 ? '...' : ''}`);
    if (activity.metadata) {
      console.log(`   Metadata: ${JSON.stringify(activity.metadata, null, 2)}`);
    }
  });

  // Check Communications table for full conversation
  console.log("\n\n📱 SMS Conversation History (from Communications table):");

  gillian.communications.forEach((comm) => {
    const direction = comm.direction === "OUTBOUND" ? "Holly →" : "Lead →";
    console.log(`\n${direction} ${comm.createdAt.toLocaleString()}`);
    console.log(comm.content);
  });

  await prisma.$disconnect();
}

investigateGillian().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
