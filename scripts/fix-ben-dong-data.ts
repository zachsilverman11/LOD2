/**
 * FIX BEN DONG'S CORRUPTED DATA
 *
 * Issue: status = "APPLICATION_STARTED" but applicationStartedAt = NULL
 * Fix: Set applicationStartedAt to the call outcome timestamp (when he was marked READY_FOR_APP)
 */

import { prisma } from "../lib/db";

async function fixBenDong() {
  console.log("=".repeat(80));
  console.log("FIXING BEN DONG'S DATA");
  console.log("=".repeat(80));
  console.log();

  const ben = await prisma.lead.findFirst({
    where: {
      firstName: { contains: "Ben", mode: "insensitive" },
      lastName: { contains: "Dong", mode: "insensitive" },
      email: "R277ben@gmail.com",
    },
    include: {
      callOutcomes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!ben) {
    console.log("❌ Ben Dong not found");
    await prisma.$disconnect();
    return;
  }

  console.log("BEFORE:");
  console.log(`  status: ${ben.status}`);
  console.log(`  applicationStartedAt: ${ben.applicationStartedAt || "NULL"}`);
  console.log();

  if (ben.status !== "APPLICATION_STARTED") {
    console.log("⚠️  Status is not APPLICATION_STARTED, skipping fix");
    await prisma.$disconnect();
    return;
  }

  if (ben.applicationStartedAt) {
    console.log("✅ applicationStartedAt already set, no fix needed");
    await prisma.$disconnect();
    return;
  }

  // Get call outcome timestamp
  const callOutcome = ben.callOutcomes[0];
  if (!callOutcome) {
    console.log("❌ No call outcome found, cannot determine application start time");
    await prisma.$disconnect();
    return;
  }

  console.log("CALL OUTCOME:");
  console.log(`  Advisor: ${callOutcome.advisorName}`);
  console.log(`  Outcome: ${callOutcome.outcome}`);
  console.log(`  Timestamp: ${callOutcome.createdAt.toISOString()}`);
  console.log();

  // Fix: Set applicationStartedAt to call outcome timestamp
  console.log("APPLYING FIX...");
  await prisma.lead.update({
    where: { id: ben.id },
    data: {
      applicationStartedAt: callOutcome.createdAt,
    },
  });

  console.log("✅ FIXED!");
  console.log();

  // Verify
  const fixed = await prisma.lead.findUnique({
    where: { id: ben.id },
  });

  console.log("AFTER:");
  console.log(`  status: ${fixed?.status}`);
  console.log(`  applicationStartedAt: ${fixed?.applicationStartedAt?.toISOString() || "NULL"}`);
  console.log();

  await prisma.$disconnect();
}

fixBenDong().catch(console.error);
