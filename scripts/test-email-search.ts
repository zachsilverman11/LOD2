/**
 * Test email searching for Ben Dong/Gong
 */

import { prisma } from "../lib/db";

async function testEmailSearch() {
  const testEmail = "r277ben@gmail.com";

  console.log("=".repeat(80));
  console.log("TESTING EMAIL SEARCH");
  console.log("=".repeat(80));
  console.log(`\nSearching for email: "${testEmail}"\n`);

  // Test 1: Exact match with toLowerCase
  const test1 = await prisma.lead.findUnique({
    where: { email: testEmail.toLowerCase() },
  });
  console.log("Test 1 - findUnique with toLowerCase:");
  console.log(test1 ? `  ✅ FOUND: ${test1.firstName} ${test1.lastName} (${test1.email})` : `  ❌ NOT FOUND`);

  // Test 2: Exact match without toLowerCase
  const test2 = await prisma.lead.findUnique({
    where: { email: testEmail },
  });
  console.log("\nTest 2 - findUnique without toLowerCase:");
  console.log(test2 ? `  ✅ FOUND: ${test2.firstName} ${test2.lastName} (${test2.email})` : `  ❌ NOT FOUND`);

  // Test 3: Case insensitive search
  const test3 = await prisma.lead.findFirst({
    where: {
      email: {
        equals: testEmail,
        mode: 'insensitive'
      }
    }
  });
  console.log("\nTest 3 - findFirst with case insensitive:");
  console.log(test3 ? `  ✅ FOUND: ${test3.firstName} ${test3.lastName} (${test3.email})` : `  ❌ NOT FOUND`);

  // Test 4: Search by name
  const test4 = await prisma.lead.findFirst({
    where: {
      AND: [
        { firstName: { contains: "Ben", mode: "insensitive" } },
        { OR: [
          { lastName: { contains: "Dong", mode: "insensitive" } },
          { lastName: { contains: "Gong", mode: "insensitive" } },
        ]}
      ]
    }
  });
  console.log("\nTest 4 - Search by name (Ben Dong OR Ben Gong):");
  console.log(test4 ? `  ✅ FOUND: ${test4.firstName} ${test4.lastName} (${test4.email})` : `  ❌ NOT FOUND`);

  // Test 5: Get actual email from database
  if (test4) {
    console.log(`\n📧 Actual email in database: "${test4.email}"`);
    console.log(`📧 Email from Finmo webhook: "${testEmail}"`);
    console.log(`📧 Match? ${test4.email === testEmail ? "✅ YES" : "❌ NO"}`);

    // Character-by-character comparison
    if (test4.email !== testEmail) {
      console.log("\n🔍 Character comparison:");
      console.log(`  DB email length: ${test4.email.length}`);
      console.log(`  Webhook email length: ${testEmail.length}`);
      console.log(`  DB email (hex): ${Buffer.from(test4.email).toString('hex')}`);
      console.log(`  Webhook email (hex): ${Buffer.from(testEmail).toString('hex')}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  await prisma.$disconnect();
}

testEmailSearch().catch(console.error);
