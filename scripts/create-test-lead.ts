import { prisma } from '@/lib/db';

async function createTestLead() {
  try {
    // Create test lead for Zach
    const lead = await prisma.lead.create({
      data: {
        firstName: 'Zach',
        lastName: 'Silverman',
        email: 'zach@inspired.mortgage',
        phone: '6048974960',
        status: 'NEW',
        consentSms: true,
        consentEmail: true,
        source: 'TEST',
        rawData: {
          phone: '6048974960',
          email: 'zach@inspired.mortgage',
          first_name: 'Zach',
          last_name: 'Silverman',
          province: 'British Columbia',
          lead_source: 'Manual Test',
          motivation_level: 'I am just browsing',
          loanAmount: '500000',
        },
        managedByAutonomous: true, // Enable autonomous management
        nextReviewAt: new Date(), // Review immediately
      },
    });

    console.log('✅ Test lead created successfully!');
    console.log('\nLead Details:');
    console.log(`  ID: ${lead.id}`);
    console.log(`  Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`  Email: ${lead.email}`);
    console.log(`  Phone: ${lead.phone}`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Managed by Autonomous: ${lead.managedByAutonomous}`);
    console.log(`\n🤖 Holly will review this lead immediately`);

    return lead;
  } catch (error) {
    console.error('Error creating test lead:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestLead();
