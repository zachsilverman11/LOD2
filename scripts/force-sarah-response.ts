import { prisma } from "../lib/db";

async function forceSarahResponse() {
  const sarah = await prisma.lead.findFirst({
    where: { firstName: "Sarah", lastName: "Crosman" },
  });

  if (!sarah) {
    console.log("Sarah not found");
    process.exit(1);
  }

  // Set nextReviewAt to NOW for immediate processing
  await prisma.lead.update({
    where: { id: sarah.id },
    data: { nextReviewAt: new Date() },
  });

  console.log("✅ Set Sarah's nextReviewAt to NOW - she'll be processed in next cron run");

  await prisma.$disconnect();
}

forceSarahResponse();
