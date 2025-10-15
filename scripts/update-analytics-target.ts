import { PrismaClient } from "@/app/generated/prisma";

const prisma = new PrismaClient();

async function updateTargets() {
  try {
    console.log("Updating analytics targets...");

    // Find existing target
    const existing = await prisma.analyticsTarget.findFirst();

    if (existing) {
      // Update existing
      const updated = await prisma.analyticsTarget.update({
        where: { id: existing.id },
        data: {
          conversionRateTarget: 25,
        },
      });
      console.log("✅ Updated existing target:", updated);
    } else {
      // Create new with correct defaults
      const created = await prisma.analyticsTarget.create({
        data: {
          contactRateTarget: 80,
          engagementRateTarget: 60,
          bookingRateTarget: 40,
          conversionRateTarget: 25,
          dealsWonRateTarget: 70,
        },
      });
      console.log("✅ Created new target:", created);
    }

    console.log("✅ Analytics targets updated successfully!");
  } catch (error) {
    console.error("❌ Error updating targets:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTargets();
