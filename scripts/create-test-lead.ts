import { prisma } from "../lib/db";

async function createTestLead() {
  const lead = await prisma.lead.create({
    data: {
      firstName: "Test",
      lastName: "McTesterson",
      email: "test@inspired.mortgage",
      phone: "+12505551234",
      status: "WAITING_FOR_APPLICATION",
      source: "test",
      consentEmail: true,
      consentSms: true,
      consentCall: true,
      rawData: {
        city: "Vancouver",
        province: "British Columbia",
        balance: "450000",
        home_value: "750000",
        lender: "test_bank",
        lead_type: "Mortgage Refinance",
        prop_type: "House or Condo",
      },
    },
  });

  console.log("✅ Test lead created!");
  console.log(`   ID: ${lead.id}`);
  console.log(`   Name: ${lead.firstName} ${lead.lastName}`);
  console.log(`   Status: ${lead.status}`);
  console.log(`\n📋 Test URL: http://localhost:3009/test/lead-detail/${lead.id}`);
}

createTestLead()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
