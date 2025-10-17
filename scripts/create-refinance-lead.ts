import { prisma } from '@/lib/db';

async function createRefinanceLead() {
  try {
    const lead = await prisma.lead.create({
      data: {
        firstName: 'Mike',
        lastName: 'Thompson',
        email: 'mike.thompson.test@example.com',
        phone: '6043334444',
        status: 'NEW',
        consentSms: true,
        consentEmail: true,
        source: 'leads_on_demand',
        rawData: {
          first_name: 'Mike',
          last_name: 'Thompson',
          email: 'mike.thompson.test@example.com',
          phone: '6043334444',
          city: 'Surrey',
          province: 'British Columbia',
          lead_type: 'Refinance',
          loanType: 'refinance',
          propertyType: 'Single Family Home',
          home_value: '950000',
          purchasePrice: '950000',
          balance: '450000',
          withdraw_amount: '150000', // Cash out
          lender: 'TD Bank',
          creditScore: '680',
          employmentStatus: 'Employed',
          motivation_level: 'I am actively looking',
          source: 'Google Search',
          capture_time: new Date().toISOString(),
          notes: 'Wants to refinance to pull out equity for renovations'
        },
        managedByAutonomous: true,
        nextReviewAt: new Date(),
      },
    });

    console.log('✅ Refinance test lead created!');
    console.log('\nLead Details:');
    console.log(`  ID: ${lead.id}`);
    console.log(`  Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`  Type: Refinance with $150K cash out`);
    console.log(`  Current Lender: TD Bank`);
    console.log(`\n🤖 Holly should mention No Bank Penalties Program (perfect for refinance)`);

    return lead;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRefinanceLead();
