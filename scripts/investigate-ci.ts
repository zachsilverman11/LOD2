import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function investigateCI() {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: 'CI', mode: 'insensitive' } },
        { lastName: { contains: 'CI', mode: 'insensitive' } },
        { email: { contains: 'ci', mode: 'insensitive' } }
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30
      },
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  console.log('\n📋 Found ' + leads.length + ' leads matching CI\n');

  for (const lead of leads) {
    const line = '='.repeat(80);
    console.log('\n' + line);
    console.log('👤 ' + lead.firstName + ' ' + lead.lastName + ' (' + lead.email + ')');
    console.log('📞 ' + lead.phone);
    console.log('📊 Status: ' + lead.status);
    console.log('🆔 Lead ID: ' + lead.id);
    console.log('📅 Created: ' + lead.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const statusChanges = lead.activities.filter((a: any) =>
      a.type === 'STATUS_CHANGE' &&
      a.createdAt >= todayStart
    );

    if (statusChanges.length > 0) {
      console.log('\n🔄 STATUS CHANGES TODAY:');
      statusChanges.forEach((change: any) => {
        console.log('  ' + change.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }) + ' - ' + change.content);
      });
    }

    console.log('\n📜 RECENT ACTIVITIES (last 10):');
    lead.activities.slice(0, 10).forEach((activity: any) => {
      const time = activity.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
      const content = activity.content?.substring(0, 100) || 'N/A';
      console.log('  ' + time + ' - ' + activity.type + ': ' + content);
    });

    console.log('\n💬 COMMUNICATIONS (last 10):');
    if (lead.communications.length === 0) {
      console.log('  ❌ NO COMMUNICATIONS FOUND');
    } else {
      lead.communications.slice(0, 10).forEach((comm: any) => {
        const time = comm.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
        const content = comm.content?.substring(0, 80) || 'N/A';
        console.log('  ' + time + ' - ' + comm.direction + ' ' + comm.channel + ': ' + content);
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
          console.log('    Notes: ' + call.notes.substring(0, 150));
        }
      });
    }
  }

  await prisma.$disconnect();
}

investigateCI().catch(console.error).finally(() => process.exit(0));
