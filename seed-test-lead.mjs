import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  // Create a test lead
  const lead = await prisma.lead.create({
    data: {
      email: 'john.doe@example.com',
      phone: '+14165551234',
      firstName: 'John',
      lastName: 'Doe',
      status: 'NEW',
      source: 'website',
      consentEmail: true,
      consentSms: true,
      consentCall: true,
      activities: {
        create: {
          type: 'WEBHOOK_RECEIVED',
          channel: 'SYSTEM',
          content: 'Test lead created'
        }
      }
    }
  });
  
  console.log('Created test lead:', lead);
  
  // Create another lead in different stage
  const lead2 = await prisma.lead.create({
    data: {
      email: 'jane.smith@example.com',
      phone: '+14165559999',
      firstName: 'Jane',
      lastName: 'Smith',
      status: 'QUALIFIED',
      source: 'referral',
      consentEmail: true,
      consentSms: true,
      consentCall: true,
      activities: {
        create: {
          type: 'EMAIL_SENT',
          channel: 'EMAIL',
          subject: 'Welcome!',
          content: 'Welcome email sent'
        }
      }
    }
  });
  
  console.log('Created test lead 2:', lead2);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
