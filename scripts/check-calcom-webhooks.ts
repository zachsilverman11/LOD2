import { prisma } from "../lib/db";

async function main() {
  const webhooks = await prisma.webhookEvent.findMany({
    where: { source: "cal_com" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`\n=== CAL.COM WEBHOOKS (${webhooks.length}) ===\n`);

  if (webhooks.length === 0) {
    console.log("No Cal.com webhooks received yet.");
    return;
  }

  webhooks.forEach((w) => {
    console.log(`[${w.createdAt.toISOString()}] ${w.eventType}`);
    console.log(`Processed: ${w.processed}`);
    console.log(`Error: ${w.error || "none"}`);
    console.log(`Payload:`, JSON.stringify(w.payload, null, 2));
    console.log("");
  });

  // Also check appointments
  console.log("\n=== APPOINTMENTS ===\n");
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { lead: true },
  });

  appointments.forEach((apt) => {
    console.log(
      `${apt.lead.firstName} ${apt.lead.lastName} - ${apt.scheduledAt.toISOString()}`
    );
    console.log(`Status: ${apt.status}`);
    console.log("");
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
