/**
 * Test script to verify Pipedrive deal creation in new pipeline
 * Run: npx tsx scripts/test-pipedrive-deal-creation.ts
 */

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || '2b211909afd7f9f3614f582af4a97a3e921a3efb';
const PIPEDRIVE_COMPANY = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'inspiredmortgage';

async function testDealCreation() {
  console.log('🧪 Testing Pipedrive Deal Creation\n');
  console.log('Pipeline: Leads on Demand (Engaged) (ID: 33)');
  console.log('Stage: App Started (ID: 239)\n');

  const API_BASE = `https://${PIPEDRIVE_COMPANY}.pipedrive.com`;

  let personId: number | null = null;
  let dealId: number | null = null;

  try {
    // Step 1: Create a test person
    console.log('📝 Step 1: Creating test person...');
    const personResponse = await fetch(
      `${API_BASE}/v1/persons?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TEST LEAD - Pipedrive Integration Test",
          email: [{ value: "test-pipedrive@example.com", primary: true }],
          phone: [{ value: "+1-555-0123", primary: true }],
        }),
      }
    );

    const personData = await personResponse.json();

    if (!personData.success) {
      throw new Error(`Failed to create person: ${JSON.stringify(personData)}`);
    }

    personId = personData.data.id;
    console.log(`✅ Test person created (ID: ${personId})\n`);

    // Step 2: Create a test deal in the new pipeline/stage
    console.log('📝 Step 2: Creating test deal...');
    const dealResponse = await fetch(
      `${API_BASE}/v1/deals?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "TEST DEAL - Integration Test",
          person_id: personId,
          value: 500000,
          currency: "CAD",
          status: "open",
          pipeline_id: 33, // Leads on Demand (Engaged)
          stage_id: 239, // App Started (first stage)
        }),
      }
    );

    const dealData = await dealResponse.json();

    if (!dealData.success) {
      throw new Error(`Failed to create deal: ${JSON.stringify(dealData)}`);
    }

    dealId = dealData.data.id;
    console.log(`✅ Test deal created (ID: ${dealId})\n`);

    // Step 3: Verify the deal is in the correct pipeline/stage
    console.log('📝 Step 3: Verifying deal placement...');
    const verifyResponse = await fetch(
      `${API_BASE}/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      throw new Error(`Failed to verify deal: ${JSON.stringify(verifyData)}`);
    }

    const deal = verifyData.data;
    console.log('✅ Deal verified:\n');
    console.log(`   Title: ${deal.title}`);
    console.log(`   Pipeline: ${deal.pipeline_id} (Expected: 33)`);
    console.log(`   Stage: ${deal.stage_id} (Expected: 239)`);
    console.log(`   Value: ${deal.currency} $${deal.value}`);
    console.log(`   Status: ${deal.status}`);
    console.log(`   URL: https://${PIPEDRIVE_COMPANY}.pipedrive.com/deal/${dealId}\n`);

    // Verify correct pipeline and stage
    if (deal.pipeline_id !== 33) {
      console.error(`❌ ERROR: Deal in wrong pipeline (${deal.pipeline_id} instead of 33)`);
      return false;
    }

    if (deal.stage_id !== 239) {
      console.error(`❌ ERROR: Deal in wrong stage (${deal.stage_id} instead of 239)`);
      return false;
    }

    console.log('✅ SUCCESS! Deal is in the correct pipeline and stage.\n');

    // Step 4: Cleanup
    console.log('📝 Step 4: Cleaning up test data...');
    console.log('Would you like to delete the test deal and person? (y/n)');
    console.log(`\nTo manually clean up:`);
    console.log(`   Delete deal: https://${PIPEDRIVE_COMPANY}.pipedrive.com/deal/${dealId}`);
    console.log(`   Delete person: https://${PIPEDRIVE_COMPANY}.pipedrive.com/person/${personId}`);

    // Auto-cleanup for automated testing
    if (process.argv.includes('--auto-cleanup')) {
      console.log('\n🗑️  Auto-cleanup enabled, deleting test data...');

      // Delete deal
      await fetch(
        `${API_BASE}/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`,
        { method: "DELETE" }
      );
      console.log(`✅ Test deal deleted (ID: ${dealId})`);

      // Delete person
      await fetch(
        `${API_BASE}/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`,
        { method: "DELETE" }
      );
      console.log(`✅ Test person deleted (ID: ${personId})`);
    }

    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);

    // Attempt cleanup on error
    if (dealId) {
      console.log(`\n🗑️  Cleaning up test deal (ID: ${dealId})...`);
      try {
        await fetch(
          `${API_BASE}/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`,
          { method: "DELETE" }
        );
        console.log(`✅ Test deal deleted`);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to delete test deal: ${cleanupError}`);
      }
    }

    if (personId) {
      console.log(`🗑️  Cleaning up test person (ID: ${personId})...`);
      try {
        await fetch(
          `${API_BASE}/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`,
          { method: "DELETE" }
        );
        console.log(`✅ Test person deleted`);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to delete test person: ${cleanupError}`);
      }
    }

    return false;
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════════');
console.log('  PIPEDRIVE INTEGRATION TEST');
console.log('  New Pipeline Configuration');
console.log('═══════════════════════════════════════════════════════════\n');

testDealCreation().then((success) => {
  console.log('\n═══════════════════════════════════════════════════════════');
  if (success) {
    console.log('  ✅ ALL TESTS PASSED');
    console.log('  Ready to deploy to production!');
  } else {
    console.log('  ❌ TESTS FAILED');
    console.log('  Do not deploy until issues are resolved.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(success ? 0 : 1);
});
