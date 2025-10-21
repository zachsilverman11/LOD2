import { runHollyAgentLoop } from '../lib/autonomous-agent';

/**
 * Test autonomous Holly agent loop manually
 */
async function testAutonomousHolly() {
  console.log('🚀 Testing Autonomous Holly Agent Loop...\n');

  try {
    await runHollyAgentLoop();
    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testAutonomousHolly();
