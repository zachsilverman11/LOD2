import { prisma } from "../lib/db";

async function main() {
  const webhooks = await prisma.webhookEvent.findMany({
    where: {
      source: "twilio",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  console.log(`\n=== RECENT TWILIO WEBHOOKS ===\n`);

  webhooks.forEach((wh) => {
    console.log(`[${wh.createdAt.toISOString()}] ${wh.eventType}`);
    console.log(`Processed: ${wh.processed}`);
    console.log(`Error: ${wh.error || "none"}`);
    console.log(`Payload:`, JSON.stringify(wh.payload, null, 2));
    console.log("");
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
