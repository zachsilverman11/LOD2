import { prisma } from '../lib/db';

async function checkAllStuckLeads() {
  console.log("🔍 Checking all leads stuck in CONTACTED with replies...\n");

  const contactedLeads = await prisma.lead.findMany({
    where: {
      status: "CONTACTED",
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  console.log(`Found ${contactedLeads.length} leads in CONTACTED status\n`);

  const stuckLeads = contactedLeads.filter((lead) => {
    const hasInbound = lead.communications.some((c) => c.direction === "INBOUND");
    return hasInbound;
  });

  console.log(`${stuckLeads.length} of them have replied (should be ENGAGED, not CONTACTED):\n`);

  for (const lead of stuckLeads) {
    const inboundCount = lead.communications.filter((c) => c.direction === "INBOUND").length;
    const outboundCount = lead.communications.filter((c) => c.direction === "OUTBOUND").length;

    console.log(`📌 ${lead.firstName} ${lead.lastName}`);
    console.log(`   Status: ${lead.status}`);
    console.log(`   Managed by Autonomous: ${lead.managedByAutonomous}`);
    console.log(`   Messages: ${inboundCount} in, ${outboundCount} out`);
    console.log(`   Last message: ${lead.communications[0]?.content?.substring(0, 100)}`);
    console.log(`   Next Review: ${lead.nextReviewAt}`);
    console.log("");
  }

  await prisma.$disconnect();
}

checkAllStuckLeads().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
