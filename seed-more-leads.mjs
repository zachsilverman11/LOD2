import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  // Contacted stage
  await prisma.lead.create({
    data: {
      email: 'mike.johnson@example.com',
      firstName: 'Mike',
      lastName: 'Johnson',
      status: 'CONTACTED',
      consentEmail: true,
      consentSms: true,
      consentCall: true,
    }
  });
  
  // Call Scheduled stage
  await prisma.lead.create({
    data: {
      email: 'sarah.williams@example.com',
      firstName: 'Sarah',
      lastName: 'Williams',
      status: 'CALL_SCHEDULED',
      consentEmail: true,
      consentSms: false,
      consentCall: true,
    }
  });
  
  // Call Completed stage
  await prisma.lead.create({
    data: {
      email: 'david.brown@example.com',
      firstName: 'David',
      lastName: 'Brown',
      status: 'CALL_COMPLETED',
      consentEmail: true,
      consentSms: true,
      consentCall: true,
    }
  });
  
  // Converted stage
  await prisma.lead.create({
    data: {
      email: 'emily.davis@example.com',
      firstName: 'Emily',
      lastName: 'Davis',
      status: 'CONVERTED',
      consentEmail: true,
      consentSms: true,
      consentCall: false,
    }
  });
  
  console.log('Created 4 more test leads!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
