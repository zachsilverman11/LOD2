import { prisma } from "../lib/db";

async function checkHollyDecision() {
  const sarah = await prisma.lead.findFirst({
    where: { firstName: "Sarah", lastName: "Crosman" },
  });

  if (!sarah) {
    console.log("Sarah not found");
    process.exit(1);
  }

  // Get most recent activities
  const activities = await prisma.leadActivity.findMany({
    where: { leadId: sarah.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log("Recent Activities:\n");
  activities.forEach((activity) => {
    console.log(`[${activity.createdAt.toISOString()}] ${activity.type}`);
    console.log(`Content: ${activity.content}`);
    if (activity.metadata) {
      console.log(`Metadata:`, activity.metadata);
    }
    console.log("---");
  });

  await prisma.$disconnect();
}

checkHollyDecision();
