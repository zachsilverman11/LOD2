import { prisma } from '../lib/db';

async function main() {
  const lastSMS = await prisma.communication.findFirst({
    where: { channel: 'SMS', direction: 'OUTBOUND' },
    orderBy: { createdAt: 'desc' },
    include: { lead: { select: { firstName: true, lastName: true } } }
  });

  console.log('Last outbound SMS:');
  console.log(`  Time: ${lastSMS?.createdAt}`);
  console.log(`  Lead: ${lastSMS?.lead.firstName} ${lastSMS?.lead.lastName}`);
  console.log(`  Hours ago: ${((Date.now() - (lastSMS?.createdAt?.getTime() || 0)) / (1000 * 60 * 60)).toFixed(1)}`);

  await prisma.$disconnect();
}

main();
