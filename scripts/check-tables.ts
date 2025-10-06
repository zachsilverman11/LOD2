import { PrismaClient } from "@/app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    // Try to query Communication table
    console.log("Checking if Communication table exists...");
    const comms = await prisma.communication.findMany({ take: 1 });
    console.log("✅ Communication table exists");
    console.log(`Found ${comms.length} records`);
  } catch (error) {
    console.error("❌ Communication table does NOT exist");
    console.error(error);
  }

  try {
    // Try to query ScheduledMessage table
    console.log("\nChecking if ScheduledMessage table exists...");
    const msgs = await prisma.scheduledMessage.findMany({ take: 1 });
    console.log("✅ ScheduledMessage table exists");
    console.log(`Found ${msgs.length} records`);
  } catch (error) {
    console.error("❌ ScheduledMessage table does NOT exist");
    console.error(error);
  }

  await prisma.$disconnect();
}

main();
