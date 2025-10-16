import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function findDuplicates() {
  console.log('\n🔍 Finding Duplicate CallOutcome Records\n');

  // Get all call outcomes grouped by leadId
  const allCallOutcomes = await prisma.callOutcome.findMany({
    include: {
      lead: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Group by leadId
  const byLead = new Map<string, any[]>();
  allCallOutcomes.forEach(call => {
    if (!byLead.has(call.leadId)) {
      byLead.set(call.leadId, []);
    }
    byLead.get(call.leadId)!.push(call);
  });

  // Find leads with multiple call outcomes
  console.log('Leads with Multiple CallOutcome Records:\n');
  let totalDuplicates = 0;

  for (const [leadId, calls] of byLead.entries()) {
    if (calls.length > 1) {
      const lead = calls[0].lead;
      console.log(`\n${lead.firstName} ${lead.lastName} (${lead.email})`);
      console.log(`Total CallOutcome records: ${calls.length}\n`);

      calls.forEach((call, i) => {
        const date = call.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
        console.log(`  ${i + 1}. ID: ${call.id}`);
        console.log(`     Date: ${date}`);
        console.log(`     Outcome: ${call.outcome}, Reached: ${call.reached}`);
        console.log(`     Quality: ${call.leadQuality || 'N/A'}`);
        console.log(`     Advisor: ${call.advisorName}`);
        if (call.notes) {
          console.log(`     Notes: ${call.notes.substring(0, 100)}...`);
        }
        console.log('');
      });

      // Suggest which to keep
      const reached = calls.filter(c => c.reached);
      if (reached.length > 1) {
        console.log(`  ⚠️  ${reached.length} records with reached=true - LIKELY DUPLICATE`);
        console.log(`  💡 Suggestion: Keep the LATEST one (most recent timestamp)`);
        console.log(`  🗑️  Delete: ${reached.slice(0, -1).map(c => c.id).join(', ')}\n`);
        totalDuplicates += reached.length - 1;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`Total leads with multiple CallOutcome records: ${Array.from(byLead.values()).filter(c => c.length > 1).length}`);
  console.log(`Estimated duplicate records to clean: ${totalDuplicates}`);

  await prisma.$disconnect();
}

findDuplicates().catch(console.error).finally(() => process.exit(0));
