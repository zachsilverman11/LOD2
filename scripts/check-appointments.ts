import { prisma } from '../lib/db';

async function main() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Recent appointments:', JSON.stringify(appointments, null, 2));
  
  const communications = await prisma.communication.findMany({
    where: { leadId: 'cmgbgq0pg0000heceu3ypbb6q' },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\nCommunications for test lead:', JSON.stringify(communications, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
