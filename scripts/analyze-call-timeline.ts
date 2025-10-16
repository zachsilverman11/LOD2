import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function analyzeCallTimeline() {
  console.log('\n📅 Call Outcome Timeline Analysis\n');
  console.log('='.repeat(80));

  const completedCalls = await prisma.callOutcome.findMany({
    where: {
      reached: true
    },
    include: {
      lead: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\nTotal Completed Calls (reached=true): ${completedCalls.length}\n`);

  // Group by date
  const byDate = new Map<string, any[]>();
  completedCalls.forEach(call => {
    const date = call.createdAt.toLocaleDateString('en-US', { timeZone: 'America/Vancouver' });
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(call);
  });

  // Show breakdown by date
  console.log('Calls by Date:\n');
  Array.from(byDate.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .forEach(([date, calls]) => {
      console.log(`${date} - ${calls.length} calls`);
      calls.forEach(call => {
        const time = call.createdAt.toLocaleTimeString('en-US', {
          timeZone: 'America/Vancouver',
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`  ${time} - ${call.lead.firstName} ${call.lead.lastName} (${call.outcome})`);
      });
      console.log('');
    });

  // Check for specific date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const callsToday = completedCalls.filter(c => c.createdAt >= today).length;
  const callsThisWeek = completedCalls.filter(c => c.createdAt >= lastWeek).length;

  console.log('\n📊 Summary:');
  console.log(`Calls Today: ${callsToday}`);
  console.log(`Calls This Week (last 7 days): ${callsThisWeek}`);
  console.log(`Total All Time: ${completedCalls.length}`);

  console.log('\n🤔 Greg\'s Count Analysis:');
  console.log(`Greg says: 8 completed calls`);
  console.log(`System shows: ${completedCalls.length} completed calls`);
  console.log(`\nPossible explanations:`);
  console.log(`1. Greg might be counting only THIS WEEK: ${callsThisWeek} calls`);
  console.log(`2. Greg might be counting only calls HE did (check advisor filter)`);
  console.log(`3. Greg might be excluding NOT_INTERESTED outcomes`);

  // Count by advisor
  console.log('\n\nCalls by Advisor:');
  const byAdvisor = new Map<string, number>();
  completedCalls.forEach(call => {
    byAdvisor.set(call.advisorName, (byAdvisor.get(call.advisorName) || 0) + 1);
  });

  byAdvisor.forEach((count, advisor) => {
    console.log(`${advisor}: ${count} calls`);
  });

  // Count by outcome
  console.log('\n\nCalls by Outcome:');
  const byOutcome = new Map<string, number>();
  completedCalls.forEach(call => {
    byOutcome.set(call.outcome, (byOutcome.get(call.outcome) || 0) + 1);
  });

  byOutcome.forEach((count, outcome) => {
    console.log(`${outcome}: ${count} calls`);
  });

  await prisma.$disconnect();
}

analyzeCallTimeline().catch(console.error).finally(() => process.exit(0));
