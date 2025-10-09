/**
 * Clean Test Data Script
 * Removes all test leads and related data for fresh production start
 *
 * DANGER: This will permanently delete data!
 */

import { prisma } from './lib/db';

async function cleanTestData() {
  console.log('🧹 CLEANING TEST DATA');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Get all leads
  const allLeads = await prisma.lead.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  console.log(`📊 Found ${allLeads.length} total leads in database\n`);

  // 2. Identify test leads
  const testLeads = allLeads.filter((lead) =>
    lead.email.includes('test') ||
    lead.email.includes('example.com') ||
    lead.email.includes('inspired.mortgage') ||
    lead.email.includes('@test.com') ||
    lead.firstName.toLowerCase().includes('test') ||
    lead.lastName.toLowerCase().includes('test')
  );

  console.log('🔍 Test leads identified:');
  console.log('───────────────────────────────────────────────────────────');
  testLeads.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.firstName} ${lead.lastName} (${lead.email})`);
  });
  console.log('');

  if (testLeads.length === 0) {
    console.log('✅ No test leads found. Database is clean!\n');
    return;
  }

  console.log(`⚠️  DANGER: This will delete ${testLeads.length} test leads and ALL related data:`);
  console.log('   - Lead records');
  console.log('   - Communications (SMS, Email)');
  console.log('   - Appointments');
  console.log('   - Activities');
  console.log('   - Notes');
  console.log('   - Tasks');
  console.log('   - Scheduled messages\n');

  // Count related records
  for (const lead of testLeads) {
    const communications = await prisma.communication.count({
      where: { leadId: lead.id },
    });
    const appointments = await prisma.appointment.count({
      where: { leadId: lead.id },
    });
    const activities = await prisma.leadActivity.count({
      where: { leadId: lead.id },
    });

    console.log(`   ${lead.email}:`);
    console.log(`     - ${communications} communications`);
    console.log(`     - ${appointments} appointments`);
    console.log(`     - ${activities} activities`);
  }

  console.log('\n⏳ Starting deletion in 3 seconds...');
  console.log('   Press Ctrl+C to cancel\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🗑️  Deleting test data...\n');

  // Delete each test lead (Prisma cascade will handle related records)
  let deleted = 0;
  for (const lead of testLeads) {
    try {
      await prisma.lead.delete({
        where: { id: lead.id },
      });
      deleted++;
      console.log(`✅ Deleted: ${lead.firstName} ${lead.lastName} (${lead.email})`);
    } catch (error) {
      console.error(`❌ Failed to delete ${lead.email}:`, error);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Cleanup Complete!`);
  console.log(`   Deleted: ${deleted}/${testLeads.length} test leads`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Final count
  const remainingLeads = await prisma.lead.count();
  console.log(`📊 Remaining leads in database: ${remainingLeads}\n`);

  if (remainingLeads === 0) {
    console.log('🎉 Database is now clean and ready for production leads!\n');
  } else {
    console.log(`⚠️  ${remainingLeads} leads remain (these were not identified as test data)\n`);
    const remaining = await prisma.lead.findMany({
      select: { email: true, firstName: true, lastName: true },
    });
    remaining.forEach(l => {
      console.log(`   - ${l.firstName} ${l.lastName} (${l.email})`);
    });
    console.log('');
  }

  await prisma.$disconnect();
}

// Run cleanup
cleanTestData().catch((error) => {
  console.error('Error during cleanup:', error);
  process.exit(1);
});
