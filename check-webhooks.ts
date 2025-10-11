import { PrismaClient } from "./app/generated/prisma";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  // Check recent Cal.com webhooks, especially cancellations
  const webhooks = await prisma.webhookEvent.findMany({
    where: {
      source: "cal_com",
      createdAt: {
        gte: new Date("2025-10-11T00:00:00Z")
      }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  console.log(`Found ${webhooks.length} Cal.com webhooks today\n`);

  for (const webhook of webhooks) {
    console.log("=== WEBHOOK ===");
    console.log(`ID: ${webhook.id}`);
    console.log(`Event Type: ${webhook.eventType}`);
    console.log(`Processed: ${webhook.processed}`);
    console.log(`Created: ${webhook.createdAt}`);
    console.log(`Payload:`, JSON.stringify(webhook.payload, null, 2).substring(0, 500));
    console.log("\n");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
