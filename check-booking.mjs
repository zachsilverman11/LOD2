import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: {
      leadId: 'cmgbf2o27000hhepob1s88i42'
    },
    orderBy: { createdAt: 'desc' }
  });
  
  const activities = await prisma.leadActivity.findMany({
    where: {
      leadId: 'cmgbf2o27000hhepob1s88i42'
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('📅 APPOINTMENTS:', appointments.length);
  if (appointments.length > 0) {
    console.log(JSON.stringify(appointments, null, 2));
  } else {
    console.log('❌ No appointments found');
  }
  
  console.log('');
  console.log('📋 RECENT ACTIVITIES:');
  activities.forEach(a => {
    console.log(`- ${a.type}: ${a.content || 'N/A'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
