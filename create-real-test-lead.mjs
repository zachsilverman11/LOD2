import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  // Create a test lead with YOUR real phone number
  const lead = await prisma.lead.create({
    data: {
      email: 'zach@inspired.mortgage',
      phone: '+16048974960',  // YOUR real number
      firstName: 'Zach',
      lastName: 'Test',
      status: 'NEW',
      source: 'test',
      consentEmail: true,
      consentSms: true,
      consentCall: true,
      activities: {
        create: {
          type: 'WEBHOOK_RECEIVED',
          channel: 'SYSTEM',
          content: 'Test lead for voice AI calling'
        }
      }
    }
  });
  
  console.log('✅ Created test lead for Zach:');
  console.log('Lead ID:', lead.id);
  console.log('Phone:', lead.phone);
  console.log('');
  console.log('📞 Holly will call THIS number when we test voice AI');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
