import { prisma } from '../lib/db';

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: 'cmgbgq0pg0000heceu3ypbb6q' }
  });
  
  console.log('Lead data:');
  console.log(JSON.stringify(lead, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
