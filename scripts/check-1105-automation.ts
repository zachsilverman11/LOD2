import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function check1105Automation() {
  // Check what happened at 11:05am today
  const time1105 = new Date('2025-10-16T11:05:00-07:00'); // PST
  const time1106 = new Date('2025-10-16T11:06:00-07:00');

  console.log('\n🔍 Checking all automation activity at 11:05am PST...\n');

  // Get all activities created between 11:05 and 11:06
  const activities = await prisma.leadActivity.findMany({
    where: {
      createdAt: {
        gte: time1105,
        lt: time1106
      }
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('📊 Found ' + activities.length + ' activities at 11:05am\n');

  activities.forEach((activity: any) => {
    const lead = activity.lead;
    console.log('⏰ ' + activity.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
    console.log('👤 ' + lead.firstName + ' ' + lead.lastName + ' (' + lead.email + ')');
    console.log('📊 Lead Status: ' + lead.status);
    console.log('🎯 Activity Type: ' + activity.type);
    console.log('📝 Content: ' + (activity.content || 'N/A'));
    console.log('---');
  });

  // Also check scheduled messages that were processed
  const messages = await prisma.scheduledMessage.findMany({
    where: {
      processedAt: {
        gte: time1105,
        lt: time1106
      }
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (messages.length > 0) {
    console.log('\n\n📬 SCHEDULED MESSAGES PROCESSED at 11:05am:');
    messages.forEach((msg: any) => {
      console.log('\n  Lead: ' + msg.lead.firstName + ' ' + msg.lead.lastName);
      console.log('  Message: ' + msg.message.substring(0, 100));
      console.log('  Scheduled For: ' + msg.scheduledFor.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
    });
  }

  await prisma.$disconnect();
}

check1105Automation().catch(console.error).finally(() => process.exit(0));
