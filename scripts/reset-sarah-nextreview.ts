import { prisma } from "@/lib/db";

async function resetSarahNextReview() {
  const sarah = await prisma.lead.findFirst({
    where: {
      firstName: "Sarah",
      lastName: "Crosman",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      managedByAutonomous: true,
      nextReviewAt: true,
      lastContactedAt: true,
    },
  });

  if (!sarah) {
    console.log("❌ Sarah Crosman not found");
    return;
  }

  console.log("Sarah Crosman:", JSON.stringify(sarah, null, 2));

  if (sarah.nextReviewAt) {
    const now = new Date();
    const minsUntilReview = Math.round(
      (sarah.nextReviewAt.getTime() - now.getTime()) / 1000 / 60
    );
    console.log(`\nNext review in: ${minsUntilReview} minutes`);

    // Reset to NOW for immediate processing
    await prisma.lead.update({
      where: { id: sarah.id },
      data: { nextReviewAt: now },
    });

    console.log("✅ Reset nextReviewAt to NOW");
  }

  await prisma.$disconnect();
}

resetSarahNextReview().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
