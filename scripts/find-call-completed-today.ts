import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function findCallCompletedToday() {
  // Get today's date range in PST
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  console.log('\n🔍 Searching for leads moved to CALL_COMPLETED today (Oct 16, PST)...\n');

  // Find all status changes to CALL_COMPLETED today
  const statusChanges = await prisma.leadActivity.findMany({
    where: {
      type: 'STATUS_CHANGE',
      createdAt: { gte: todayStart },
      content: { contains: 'CALL_COMPLETED' }
    },
    include: {
      lead: {
        include: {
          communications: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          callOutcomes: {
            orderBy: { createdAt: 'desc' },
            take: 3
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 15,
            where: {
              createdAt: { gte: todayStart }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📊 Found ${statusChanges.length} status changes to CALL_COMPLETED today\n`);

  for (const change of statusChanges) {
    const lead = change.lead;
    const line = '='.repeat(80);
    console.log('\n' + line);
    console.log('👤 ' + lead.firstName + ' ' + lead.lastName + ' (' + lead.email + ')');
    console.log('📞 ' + lead.phone);
    console.log('🆔 Lead ID: ' + lead.id);
    console.log('📅 Status changed at: ' + change.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
    console.log('📊 Current Status: ' + lead.status);

    console.log('\n🔄 STATUS CHANGE DETAILS:');
    console.log('  ' + change.content);

    console.log('\n📜 ACTIVITIES TODAY:');
    if (lead.activities.length === 0) {
      console.log('  ❌ NO ACTIVITIES TODAY');
    } else {
      lead.activities.forEach((activity: any) => {
        const time = activity.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
        const content = activity.content?.substring(0, 120) || 'N/A';
        console.log('  ' + time + ' - ' + activity.type);
        console.log('    ' + content);
      });
    }

    console.log('\n💬 RECENT COMMUNICATIONS:');
    if (lead.communications.length === 0) {
      console.log('  ❌ NO COMMUNICATIONS');
    } else {
      lead.communications.forEach((comm: any) => {
        const time = comm.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
        const content = comm.content?.substring(0, 80) || 'N/A';
        console.log('  ' + time + ' - ' + comm.direction + ' ' + comm.channel);
        console.log('    ' + content);
      });
    }

    console.log('\n📞 CALL OUTCOMES:');
    if (lead.callOutcomes.length === 0) {
      console.log('  ❌ NO CALL OUTCOMES FOUND');
    } else {
      lead.callOutcomes.forEach((call: any) => {
        const time = call.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
        console.log('  ' + time + ' - ' + call.outcome + ' (Quality: ' + (call.leadQuality || 'N/A') + ')');
        console.log('    Reached: ' + call.reached + ', Advisor: ' + (call.advisorEmail || 'N/A'));
        if (call.notes) {
          console.log('    Notes: ' + call.notes);
        }
      });
    }
  }

  await prisma.$disconnect();
}

findCallCompletedToday().catch(console.error).finally(() => process.exit(0));
