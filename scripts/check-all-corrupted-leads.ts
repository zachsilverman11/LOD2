/**
 * CHECK FOR OTHER CORRUPTED LEADS
 * Find all leads with status=APPLICATION_STARTED but applicationStartedAt=NULL
 */

import { prisma } from "../lib/db";

async function checkCorruptedLeads() {
  console.log("=".repeat(80));
  console.log("CHECKING FOR CORRUPTED LEADS");
  console.log("=".repeat(80));
  console.log();

  const corrupted = await prisma.lead.findMany({
    where: {
      status: "APPLICATION_STARTED",
      applicationStartedAt: null,
    },
    include: {
      callOutcomes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  console.log(`Found ${corrupted.length} corrupted leads\n`);

  if (corrupted.length === 0) {
    console.log("✅ No corrupted leads found!");
  } else {
    console.log("🚨 CORRUPTED LEADS:");
    corrupted.forEach((lead, i) => {
      console.log(`\n${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.email})`);
      console.log(`   ID: ${lead.id}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   applicationStartedAt: NULL ❌`);
      if (lead.callOutcomes[0]) {
        console.log(`   Last Call: ${lead.callOutcomes[0].outcome} by ${lead.callOutcomes[0].advisorName} at ${lead.callOutcomes[0].createdAt.toLocaleString()}`);
      }
    });
  }

  console.log();
  await prisma.$disconnect();
}

checkCorruptedLeads().catch(console.error);
