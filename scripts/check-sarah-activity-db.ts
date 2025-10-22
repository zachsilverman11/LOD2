import { prisma } from "../lib/db";

async function checkSarahActivity() {
  const sarah = await prisma.lead.findFirst({
    where: { firstName: "Sarah", lastName: "Crosman" },
  });

  if (!sarah) {
    console.log("Sarah not found");
    process.exit(1);
  }

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: sarah.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log("Most recent activities:");
  activities.forEach((a) => {
    console.log(`[${a.createdAt.toISOString()}] ${a.type}`);
    console.log(a.content.substring(0, 200));
    console.log("---");
  });

  // Check nextReviewAt
  const lead = await prisma.lead.findUnique({
    where: { id: sarah.id },
    select: { nextReviewAt: true, hollyDisabled: true },
  });

  console.log(`\nNext review at: ${lead?.nextReviewAt?.toISOString()}`);
  console.log(`Holly disabled: ${lead?.hollyDisabled}`);

  await prisma.$disconnect();
}

checkSarahActivity();
