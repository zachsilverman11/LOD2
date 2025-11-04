import { PrismaClient, LeadStatus } from "@/app/generated/prisma";

const prisma = new PrismaClient();

/**
 * Fix leads that were incorrectly moved from CONVERTED/LOST back to CALL_COMPLETED
 * by the appointment auto-complete bug
 */
async function fixWronglyMovedLeads() {
  try {
    console.log("Finding leads that should be CONVERTED or LOST...\n");

    // Find leads in WAITING_FOR_APPLICATION that have applicationCompletedAt (should be CONVERTED)
    const shouldBeConverted = await prisma.lead.findMany({
      where: {
        status: LeadStatus.WAITING_FOR_APPLICATION,
        applicationCompletedAt: {
          not: null,
        },
      },
    });

    console.log(`Found ${shouldBeConverted.length} leads that should be CONVERTED:`);
    for (const lead of shouldBeConverted) {
      console.log(`  - ${lead.firstName} ${lead.lastName} (completed app: ${lead.applicationCompletedAt})`);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.CONVERTED },
      });
      console.log(`    ✅ Moved to CONVERTED`);
    }

    // Find leads in WAITING_FOR_APPLICATION with call outcome NOT_INTERESTED (should be LOST)
    const shouldBeLost = await prisma.lead.findMany({
      where: {
        status: LeadStatus.WAITING_FOR_APPLICATION,
        callOutcomes: {
          some: {
            outcome: "NOT_INTERESTED",
          },
        },
      },
      include: {
        callOutcomes: true,
      },
    });

    console.log(`\nFound ${shouldBeLost.length} leads that should be LOST:`);
    for (const lead of shouldBeLost) {
      const notInterestedOutcome = lead.callOutcomes.find((co) => co.outcome === "NOT_INTERESTED");
      console.log(`  - ${lead.firstName} ${lead.lastName} (outcome: ${notInterestedOutcome?.outcome})`);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.LOST },
      });
      console.log(`    ✅ Moved to LOST`);
    }

    console.log("\n✅ All leads fixed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWronglyMovedLeads();
