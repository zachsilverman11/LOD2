import { prisma } from '../lib/db';

async function checkMirren() {
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Mirren', mode: 'insensitive' } },
        { lastName: { contains: 'Mirren', mode: 'insensitive' } }
      ]
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!lead) {
    console.log('No lead found with name Mirren');
    return;
  }

  console.log('\nLead Info:');
  console.log('Name:', lead.firstName, lead.lastName);
  console.log('Email:', lead.email);
  console.log('Status:', lead.status);
  console.log('Managed by Autonomous:', lead.managedByAutonomous);
  console.log('Holly Disabled:', lead.hollyDisabled);
  console.log('Consent SMS:', lead.consentSms);
  console.log('Last Contacted:', lead.lastContactedAt);
  console.log('Next Review At:', lead.nextReviewAt);
  
  console.log('\nRecent Communications (last 10):');
  lead.communications.forEach(comm => {
    const time = comm.createdAt.toISOString();
    const preview = comm.content.substring(0, 60);
    console.log(comm.direction, '[' + time + ']:', preview);
  });
}

checkMirren().then(() => process.exit(0)).catch(console.error);
