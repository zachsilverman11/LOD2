import { prisma } from "../lib/db";

async function main() {
  const leadId = process.argv[2] || "cmgfjbvh0000eii043r82tkx3";

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    console.log("Lead not found");
    return;
  }

  console.log(`\n=== LEAD: ${lead.firstName} ${lead.lastName} (${lead.phone}) ===`);
  console.log(`Email: ${lead.email}`);
  console.log(`Status: ${lead.status}\n`);

  const comms = await prisma.communication.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total communications: ${comms.length}\n`);

  comms.forEach((comm) => {
    console.log(`[${comm.direction}] ${comm.createdAt.toISOString()}`);
    console.log(comm.content);
    console.log("");
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
