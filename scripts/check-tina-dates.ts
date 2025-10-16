/**
 * CHECK TINA DIXON DATE ISSUE
 * User reports: Lead detail shows "submitted December 10th, 2025 at 2:44pm"
 * But it's October 16th, 2025
 */

import { prisma } from "../lib/db";

async function checkTinaDates() {
  console.log("=".repeat(80));
  console.log("TINA DIXON DATE INVESTIGATION");
  console.log("Current Server Time:", new Date().toISOString());
  console.log("Current PST Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  console.log("=".repeat(80));
  console.log();

  const tina = await prisma.lead.findFirst({
    where: {
      firstName: { contains: "Tina", mode: "insensitive" },
      lastName: { contains: "Dixon", mode: "insensitive" },
    },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
      },
      communications: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tina) {
    console.log("❌ Tina Dixon not found");
    await prisma.$disconnect();
    return;
  }

  console.log("TINA DIXON RECORD:");
  console.log("==================");
  console.log("ID:", tina.id);
  console.log("Email:", tina.email);
  console.log("Status:", tina.status);
  console.log();

  console.log("DATABASE TIMESTAMPS:");
  console.log("-------------------");
  console.log("createdAt (raw):", tina.createdAt);
  console.log("createdAt (ISO):", tina.createdAt.toISOString());
  console.log("createdAt (PST):", tina.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  console.log();
  console.log("updatedAt (raw):", tina.updatedAt);
  console.log("updatedAt (ISO):", tina.updatedAt.toISOString());
  console.log("updatedAt (PST):", tina.updatedAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  console.log();
  console.log("lastContactedAt (raw):", tina.lastContactedAt);
  console.log("lastContactedAt (ISO):", tina.lastContactedAt?.toISOString());
  console.log("lastContactedAt (PST):", tina.lastContactedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  console.log();

  console.log("RAW DATA FROM WEBHOOK:");
  console.log("----------------------");
  const rawData = tina.rawData as any;
  console.log("capture_time:", rawData?.capture_time);
  console.log("Full rawData:", JSON.stringify(rawData, null, 2));
  console.log();

  console.log("ACTIVITIES (showing dates):");
  console.log("---------------------------");
  tina.activities.slice(0, 5).forEach(act => {
    console.log(`${act.type}:`);
    console.log(`  createdAt (raw): ${act.createdAt}`);
    console.log(`  createdAt (ISO): ${act.createdAt.toISOString()}`);
    console.log(`  createdAt (PST): ${act.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log();
  });

  console.log("COMMUNICATIONS (showing dates):");
  console.log("-------------------------------");
  tina.communications.slice(0, 3).forEach(comm => {
    console.log(`${comm.direction} ${comm.channel}:`);
    console.log(`  createdAt (raw): ${comm.createdAt}`);
    console.log(`  createdAt (ISO): ${comm.createdAt.toISOString()}`);
    console.log(`  createdAt (PST): ${comm.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log(`  Content: "${comm.content.substring(0, 60)}..."`);
    console.log();
  });

  await prisma.$disconnect();
}

checkTinaDates().catch(console.error);
