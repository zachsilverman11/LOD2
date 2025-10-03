/**
 * Seed production database with a test lead
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding production database...");

  const lead = await prisma.lead.create({
    data: {
      email: "zach@inspired.mortgage",
      phone: "+16048974960",
      firstName: "Zach",
      lastName: "Silverman",
      status: "NEW",
      source: "production-test",
      consentEmail: true,
      consentSms: true,
      consentCall: true,
    },
  });

  console.log("✅ Test lead created:", lead.id);
  console.log("\nNow run:");
  console.log(`curl -X POST https://lod2-a9incracj-zach-silvermans-projects.vercel.app/api/voice/initiate-call -H "Content-Type: application/json" -d '{"leadId": "${lead.id}"}'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
