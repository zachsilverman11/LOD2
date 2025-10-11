import { PrismaClient } from "./app/generated/prisma";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const lead = await prisma.lead.findFirst({
    where: {
      firstName: {
        contains: "Marina",
        mode: "insensitive"
      }
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  });

  if (!lead) {
    console.log("Marina not found");
    return;
  }

  console.log(`=== MARINA'S RECENT COMMUNICATIONS ===\n`);

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
