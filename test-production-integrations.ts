/**
 * Test Production Integrations
 * Tests Finmo and Pipedrive via production endpoints
 */

console.log('🧪 Testing Production Integrations...\n');

const PRODUCTION_URL = 'https://lod2.vercel.app';

// Test 1: Test Finmo Webhook Endpoint (application.started)
console.log('📋 Test 1: Finmo Webhook - Application Started');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testFinmoApplicationStarted() {
  const payload = {
    event: 'application.started',
    application: {
      id: 'test-app-' + Date.now(),
      email: 'jakub@inspired.mortgage', // Using existing test lead
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'in_progress'
    }
  };

  console.log('📤 Sending test payload:');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/webhooks/finmo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Finmo webhook accepted');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, data);
    } else {
      console.log('\n⚠️  Webhook response:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, data);
    }
  } catch (error) {
    console.log('\n❌ Request failed');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Test 2: Test Finmo Webhook Endpoint (application.completed)
console.log('📋 Test 2: Finmo Webhook - Application Completed');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testFinmoApplicationCompleted() {
  const payload = {
    event: 'application.completed',
    application: {
      id: 'test-app-' + Date.now(),
      email: 'jakub@inspired.mortgage', // Using existing test lead
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'completed',
      submittedAt: new Date().toISOString()
    }
  };

  console.log('📤 Sending test payload:');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/webhooks/finmo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Finmo webhook accepted');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, data);
      console.log('\n📝 Expected outcomes:');
      console.log('   1. Lead status → CONVERTED');
      console.log('   2. Pipedrive deal created in "Leads on Demand (Engaged)" pipeline');
      console.log('   3. Deal placed in "App Started" stage');
      console.log('   4. Slack notification sent');
    } else {
      console.log('\n⚠️  Webhook response:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, data);
    }
  } catch (error) {
    console.log('\n❌ Request failed');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Test 3: Check Lead Status After Tests
console.log('📋 Test 3: Verify Lead Status Changes');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function checkLeadStatus() {
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/leads`);
    const leads = await response.json();

    const jakubLead = leads.find((l: any) => l.email === 'jakub@inspired.mortgage');

    if (jakubLead) {
      console.log('✅ Test lead found:');
      console.log(`   Name: ${jakubLead.firstName} ${jakubLead.lastName}`);
      console.log(`   Email: ${jakubLead.email}`);
      console.log(`   Status: ${jakubLead.status}`);
      console.log(`   Application Started: ${jakubLead.applicationStartedAt || 'Not yet'}`);
      console.log(`   Application Completed: ${jakubLead.applicationCompletedAt || 'Not yet'}`);
      console.log(`   Converted: ${jakubLead.convertedAt || 'Not yet'}`);
    } else {
      console.log('❌ Test lead not found');
    }
  } catch (error) {
    console.log('❌ Failed to fetch lead');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Test 4: Manual Pipedrive Test (using your credentials)
console.log('📋 Test 4: Pipedrive API Direct Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testPipedriveDirect() {
  const PIPEDRIVE_API_TOKEN = '2b211909afd7f9f3614f582af4a97a3e921a3efb';
  const PIPEDRIVE_COMPANY = 'inspiredmortgage';

  try {
    // Test 1: Get current user
    const userResponse = await fetch(
      `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/users/me?api_token=${PIPEDRIVE_API_TOKEN}`
    );

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Pipedrive API connection successful');
      console.log(`   Connected as: ${userData.data.name}`);
      console.log(`   Email: ${userData.data.email}`);
    } else {
      console.log('❌ Pipedrive API connection failed');
      console.log(`   Status: ${userResponse.status}`);
    }

    // Test 2: Verify pipeline and stage
    const stagesResponse = await fetch(
      `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/stages?pipeline_id=33&api_token=${PIPEDRIVE_API_TOKEN}`
    );

    if (stagesResponse.ok) {
      const stagesData = await stagesResponse.json();
      const appStartedStage = stagesData.data.find((s: any) => s.id === 239);

      console.log('\n✅ Pipeline configuration verified');
      console.log(`   Pipeline: Leads on Demand (Engaged) (ID: 33)`);
      console.log(`   Stage: ${appStartedStage.name} (ID: 239)`);
      console.log(`   Order: ${appStartedStage.order_nr} of ${stagesData.data.length}`);
    }

    // Test 3: Check recent deals
    const dealsResponse = await fetch(
      `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/deals?limit=5&sort=update_time DESC&api_token=${PIPEDRIVE_API_TOKEN}`
    );

    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      console.log(`\n✅ Recent deals in Pipedrive: ${dealsData.data?.length || 0}`);

      if (dealsData.data?.length > 0) {
        const latestDeal = dealsData.data[0];
        console.log(`   Latest: ${latestDeal.title}`);
        console.log(`   Stage ID: ${latestDeal.stage_id}`);
        console.log(`   Updated: ${new Date(latestDeal.update_time).toLocaleString()}`);
      }
    }

  } catch (error) {
    console.log('❌ Pipedrive test failed');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Run all tests
async function runAllTests() {
  console.log('⏱️  Running tests sequentially to avoid conflicts...\n');

  // First check current state
  await checkLeadStatus();

  // Test Finmo webhooks
  console.log('⚠️  NOTE: These will update Jakub\'s test lead!\n');
  console.log('Press Ctrl+C now if you don\'t want to run these tests.\n');

  // Wait 2 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 2000));

  await testFinmoApplicationStarted();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testFinmoApplicationCompleted();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check state after tests
  await checkLeadStatus();

  // Test Pipedrive directly
  await testPipedriveDirect();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All integration tests complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Next steps:');
  console.log('   1. Check Jakub\'s lead in dashboard');
  console.log('   2. Check Pipedrive for new deal');
  console.log('   3. Check Slack for notifications');
}

runAllTests().catch(console.error);
