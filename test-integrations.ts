/**
 * Integration Test Suite
 * Tests Finmo and Pipedrive integrations without sending real leads
 */

console.log('🧪 Starting Integration Tests...\n');

// Test 1: Finmo Webhook Configuration
console.log('📋 Test 1: Finmo Webhook Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const finmoWebhookUrl = process.env.FINMO_WEBHOOK_URL;
const applicationUrl = process.env.APPLICATION_URL;

if (finmoWebhookUrl) {
  console.log('✅ FINMO_WEBHOOK_URL is configured');
  console.log(`   ${finmoWebhookUrl}`);
} else {
  console.log('❌ FINMO_WEBHOOK_URL is missing');
}

if (applicationUrl) {
  console.log('✅ APPLICATION_URL is configured');
  console.log(`   ${applicationUrl}`);
} else {
  console.log('❌ APPLICATION_URL is missing');
}

console.log('\n');

// Test 2: Pipedrive Configuration
console.log('📋 Test 2: Pipedrive Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN;
const pipedriveCompany = process.env.PIPEDRIVE_COMPANY_DOMAIN;

if (pipedriveToken) {
  console.log('✅ PIPEDRIVE_API_TOKEN is configured');
  console.log(`   ${pipedriveToken.substring(0, 10)}...${pipedriveToken.substring(pipedriveToken.length - 4)}`);
} else {
  console.log('❌ PIPEDRIVE_API_TOKEN is missing');
}

if (pipedriveCompany) {
  console.log('✅ PIPEDRIVE_COMPANY_DOMAIN is configured');
  console.log(`   ${pipedriveCompany}`);
} else {
  console.log('❌ PIPEDRIVE_COMPANY_DOMAIN is missing');
}

console.log('\n');

// Test 3: Pipedrive API Connection
console.log('📋 Test 3: Pipedrive API Connection');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testPipedriveConnection() {
  if (!pipedriveToken || !pipedriveCompany) {
    console.log('⏭️  Skipped (missing credentials)\n');
    return;
  }

  try {
    const response = await fetch(
      `https://${pipedriveCompany}.pipedrive.com/v1/users/me?api_token=${pipedriveToken}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Pipedrive API connection successful');
      console.log(`   Connected as: ${data.data.name} (${data.data.email})`);
      console.log(`   Company: ${data.data.company_name || 'N/A'}`);
    } else {
      const error = await response.text();
      console.log('❌ Pipedrive API connection failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log('❌ Pipedrive API connection error');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Test 4: Pipedrive Pipeline Configuration
console.log('📋 Test 4: Pipedrive Pipeline Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testPipelinePipeline() {
  if (!pipedriveToken || !pipedriveCompany) {
    console.log('⏭️  Skipped (missing credentials)\n');
    return;
  }

  try {
    // Get pipeline stages
    const response = await fetch(
      `https://${pipedriveCompany}.pipedrive.com/v1/stages?pipeline_id=22&api_token=${pipedriveToken}`
    );

    if (response.ok) {
      const data = await response.json();
      const docCollectionStage = data.data.find((s: any) => s.id === 152);

      if (docCollectionStage) {
        console.log('✅ Pipeline configured correctly');
        console.log(`   Pipeline: ${docCollectionStage.pipeline_name} (ID: 22)`);
        console.log(`   Stage: ${docCollectionStage.name} (ID: 152)`);
        console.log(`   Deal Probability: ${docCollectionStage.deal_probability}%`);
      } else {
        console.log('❌ Doc Collection stage not found');
        console.log(`   Available stages: ${data.data.map((s: any) => `${s.name} (${s.id})`).join(', ')}`);
      }
    } else {
      console.log('❌ Failed to fetch pipeline stages');
      console.log(`   Status: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Pipeline configuration error');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Test 5: Simulate Finmo Webhook Payload
console.log('📋 Test 5: Finmo Webhook Payload Structure');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const mockFinmoPayload = {
  event: 'application.started',
  application: {
    id: 'test-app-123',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
};

console.log('✅ Sample Finmo webhook payload structure:');
console.log(JSON.stringify(mockFinmoPayload, null, 2));
console.log('\n📝 Expected events:');
console.log('   - application.started → Sets APPLICATION_STARTED status');
console.log('   - application.completed → Sets CONVERTED status + creates Pipedrive deal');

console.log('\n');

// Test 6: Database Lead Query (to verify we can find leads)
console.log('📋 Test 6: Database Connection & Lead Lookup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testDatabaseConnection() {
  try {
    const { prisma } = await import('./lib/db');

    const leadCount = await prisma.lead.count();
    console.log(`✅ Database connection successful`);
    console.log(`   Total leads in system: ${leadCount}`);

    // Find a lead we could use for testing
    const testLead = await prisma.lead.findFirst({
      where: {
        email: { contains: '@inspired.mortgage' }
      }
    });

    if (testLead) {
      console.log(`✅ Found test lead: ${testLead.firstName} ${testLead.lastName} (${testLead.email})`);
      console.log(`   Lead ID: ${testLead.id}`);
      console.log(`   Status: ${testLead.status}`);
      console.log('\n💡 You could test Finmo webhook with this lead\'s email');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.log('❌ Database connection error');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n');
}

// Run all tests
async function runAllTests() {
  await testPipedriveConnection();
  await testPipelinePipeline();
  await testDatabaseConnection();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Integration tests complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runAllTests().catch(console.error);
