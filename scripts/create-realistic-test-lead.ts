import { prisma } from '@/lib/db';

async function createRealisticLead() {
  try {
    // Create test lead with FULL webhook data (like real leads come in)
    const lead = await prisma.lead.create({
      data: {
        firstName: 'Sarah',
        lastName: 'Chen',
        email: 'sarah.chen.test@example.com',
        phone: '6042234567',
        status: 'NEW',
        consentSms: true,
        consentEmail: true,
        source: 'leads_on_demand',
        rawData: {
          // Full webhook payload
          first_name: 'Sarah',
          last_name: 'Chen',
          email: 'sarah.chen.test@example.com',
          phone: '6042234567',
          city: 'Vancouver',
          province: 'British Columbia',

          // Lead details
          lead_type: 'Home Purchase',
          loanType: 'purchase',
          propertyType: 'Single Family Home',
          prop_type: 'Single Family Home',

          // Purchase details
          purchasePrice: '850000',
          home_value: '850000',
          loanAmount: '680000',
          downPayment: '170000',
          down_payment: '170000',

          // Urgency indicator
          motivation_level: 'I have made an offer to purchase',

          // Credit
          creditScore: '720',

          // Employment
          employmentStatus: 'Employed',

          // Source tracking
          source: 'Facebook Lead Ad',
          ad_source: 'Facebook - Vancouver Home Buyers',
          capture_time: new Date().toISOString(),

          notes: 'Found us through Facebook ad targeting Vancouver first-time buyers'
        },
        managedByAutonomous: true,
        nextReviewAt: new Date(), // Review immediately
      },
    });

    console.log('✅ Realistic test lead created successfully!');
    console.log('\nLead Details:');
    console.log(`  ID: ${lead.id}`);
    console.log(`  Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`  Email: ${lead.email}`);
    console.log(`  Phone: ${lead.phone}`);
    console.log(`  Type: Purchase ($850K with accepted offer)`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Managed by Autonomous: ${lead.managedByAutonomous}`);
    console.log(`\n🎯 This is an URGENT lead - accepted offer on $850K property`);
    console.log(`🤖 Holly should recognize urgency and mention Guaranteed Approvals Certificate`);

    return lead;
  } catch (error) {
    console.error('Error creating realistic lead:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRealisticLead();
