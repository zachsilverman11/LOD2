import { prisma } from "../lib/db";

async function main() {
  const comms = await prisma.communication.findMany({
    where: {
      leadId: "cmgfhjvv5000ohe56odyvf9ud",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log("\n=== CONVERSATION HISTORY ===\n");
  comms.forEach((comm) => {
    console.log(`[${comm.direction}] ${comm.createdAt.toISOString()}`);
    console.log(comm.content);
    console.log("");
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
