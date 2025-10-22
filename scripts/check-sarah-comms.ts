import { prisma } from "../lib/db";

async function checkSarahComms() {
  const sarah = await prisma.lead.findFirst({
    where: { firstName: "Sarah", lastName: "Crosman" },
  });

  if (!sarah) {
    console.log("Sarah not found");
    process.exit(1);
  }

  const recentComms = await prisma.communication.findMany({
    where: { leadId: sarah.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log("Recent Communications:");
  recentComms.forEach((comm) => {
    console.log({
      direction: comm.direction,
      content: comm.content.substring(0, 100),
      createdAt: comm.createdAt.toISOString(),
    });
  });

  // Check lead status
  const lead = await prisma.lead.findUnique({
    where: { id: sarah.id },
    select: {
      status: true,
      nextReviewAt: true,
      managedByAutonomous: true,
      hollyDisabled: true,
    },
  });

  console.log("\nLead Status:", lead);

  await prisma.$disconnect();
}

checkSarahComms();
