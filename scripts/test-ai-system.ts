import 'dotenv/config';

/**
 * Test the AI system with sample lead data
 */
async function testAISystem() {
  console.log('🧪 Testing AI Nurture System\n');

  const testLeads = [
    {
      name: 'Purchase Lead Test',
      data: {
        name: "Sarah Johnson",
        email: "sarah.test@example.com",
        phone: "6041234567",
        lead_type: "Home Purchase",
        prop_type: "Condo",
        home_value: "850000",
        down_payment: "100000",
        motivation_level: "Made an offer",
        city: "Vancouver",
        province: "British Columbia",
        rent_check: "Yes",
        ad_source: "Google",
        capture_time: new Date().toISOString(),
        consent: "TRUE"
      }
    },
    {
      name: 'Refinance Lead Test',
      data: {
        name: "Mike Chen",
        email: "mike.test@example.com",
        phone: "6049876543",
        lead_type: "Refinance",
        prop_type: "House",
        home_value: "1200000",
        balance: "300000",
        withdraw_amount: "50000",
        lender: "TD Bank",
        city: "Burnaby",
        province: "British Columbia",
        rent_check: "Yes",
        ad_source: "Facebook",
        capture_time: new Date().toISOString(),
        consent: "TRUE"
      }
    },
    {
      name: 'Renewal Lead Test',
      data: {
        name: "Lisa Wong",
        email: "lisa.test@example.com",
        phone: "6045551234",
        lead_type: "Renewal",
        prop_type: "Townhouse",
        home_value: "950000",
        balance: "400000",
        timeframe: "1-3 Months",
        lender: "RBC",
        extend_amortization: "Yes",
        city: "Richmond",
        province: "British Columbia",
        rent_check: "Yes",
        ad_source: "Google",
        capture_time: new Date().toISOString(),
        consent: "TRUE"
      }
    }
  ];

  console.log('Available test scenarios:\n');
  testLeads.forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.name}`);
    console.log(`   Type: ${lead.data.lead_type}`);
    console.log(`   Expected AI Behavior: Should lead with ${
      lead.data.lead_type === 'Home Purchase' ? 'Guaranteed Approvals' :
      lead.data.lead_type === 'Refinance' ? 'No Bank Penalties' :
      'Reserved Ultra-Low Rates'
    }`);
    console.log('');
  });

  console.log('📋 To test, run this command:\n');
  console.log('curl -X POST http://localhost:3000/api/webhooks/leads-on-demand \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'', JSON.stringify(testLeads[0].data, null, 2), '\'');
  console.log('\n');

  console.log('💡 Or test all three at once:\n');
  testLeads.forEach((lead, i) => {
    console.log(`# Test ${i + 1}: ${lead.name}`);
    console.log(`curl -X POST http://localhost:3000/api/webhooks/leads-on-demand -H "Content-Type: application/json" -d '${JSON.stringify(lead.data)}'`);
    console.log('');
  });

  console.log('📱 Check your phone for SMS messages from Twilio!\n');
  console.log('✅ System is ready to test!');
}

testAISystem();
