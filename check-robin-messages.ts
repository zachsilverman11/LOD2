import { PrismaClient } from "./app/generated/prisma";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const lead = await prisma.lead.findFirst({
    where: {
      firstName: "Robin",
      lastName: "Sindia"
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10
      },
      callOutcomes: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!lead) {
    console.log("Robin not found");
    return;
  }

  console.log(`=== ROBIN'S STATUS: ${lead.status} ===\n`);

  console.log(`=== CALL OUTCOMES ===`);
  for (const outcome of lead.callOutcomes) {
    console.log(`[${outcome.createdAt.toISOString()}]`);
    console.log(`Advisor: ${outcome.advisorName}`);
    console.log(`Outcome: ${outcome.outcome}`);
    console.log(`Notes: ${outcome.notes}`);
    console.log(`---\n`);
  }

  console.log(`=== RECENT COMMUNICATIONS ===`);
  for (const comm of lead.communications) {
    console.log(`[${comm.createdAt.toISOString()}]`);
    console.log(`Direction: ${comm.direction}`);
    console.log(`Channel: ${comm.channel}`);
    console.log(`Content: ${comm.content}`);
    console.log(`---\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
