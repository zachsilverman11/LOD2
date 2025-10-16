import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function deleteDuplicates() {
  console.log('\n🗑️  Deleting Duplicate CallOutcome Records\n');
  console.log('Only deleting TRUE duplicates (same lead, same outcome, within minutes)\n');

  // Duplicate IDs identified from analysis:
  // 1. Ben Dong - First record (10:01:06 AM)
  // 2. Michaela Segal - First record (3:20:14 PM)

  const duplicatesToDelete = [
    'cmgto2c7t0001l704b3u3ck9f', // Ben Dong - 10:01:06 AM
    'cmgr4l1o6001ajp041bw2wj90', // Michaela Segal - 3:20:14 PM
  ];

  console.log('CallOutcome IDs to delete:');
  for (const id of duplicatesToDelete) {
    const record = await prisma.callOutcome.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (record) {
      console.log(`\n  ${record.lead.firstName} ${record.lead.lastName} (${record.lead.email})`);
      console.log(`  ID: ${id}`);
      console.log(`  Date: ${record.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
      console.log(`  Outcome: ${record.outcome}, Reached: ${record.reached}`);
    }
  }

  console.log('\n⚠️  About to delete these records. Continue? (This is running automatically)\n');

  // Delete the duplicates
  const result = await prisma.callOutcome.deleteMany({
    where: {
      id: {
        in: duplicatesToDelete
      }
    }
  });

  console.log(`✅ Deleted ${result.count} duplicate CallOutcome records\n`);

  // Verify counts after deletion
  const totalCallOutcomes = await prisma.callOutcome.count({
    where: {
      reached: true
    }
  });

  console.log(`📊 Updated counts:`);
  console.log(`Total CallOutcomes with reached=true: ${totalCallOutcomes}`);
  console.log(`Expected: Should be 16 (was 18 before deletion)\n`);

  await prisma.$disconnect();
}

deleteDuplicates().catch(console.error).finally(() => process.exit(0));
