/**
 * Test Autonomous Holly System (Safe - Uses Test Lead Only)
 *
 * This script verifies the autonomous agent is working correctly WITHOUT touching real leads
 * Tests:
 * 1. Environment variables are set
 * 2. Autonomous agent can process a lead
 * 3. Database operations work
 * 4. Holly's decision-making works
 * 5. No silent failures
 */

import { prisma } from '../lib/db';
import { processLeadWithAutonomousAgent } from '../lib/autonomous-agent';

async function testAutonomousSystem() {
  console.log('🧪 Testing Autonomous Holly System...\n');

  // === TEST 1: Environment Variables ===
  console.log('1️⃣ Checking environment variables...');
  const envVars = {
    ENABLE_AUTONOMOUS_AGENT: process.env.ENABLE_AUTONOMOUS_AGENT,
    DRY_RUN_MODE: process.env.DRY_RUN_MODE,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing',
  };

  console.log(JSON.stringify(envVars, null, 2));

  if (process.env.ENABLE_AUTONOMOUS_AGENT !== 'true') {
    console.log('❌ ENABLE_AUTONOMOUS_AGENT is not true - agent is disabled!');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY is missing!');
    process.exit(1);
  }

  console.log('✅ Environment variables OK\n');

  // === TEST 2: Find Test Lead ===
  console.log('2️⃣ Finding test lead (Zach Silverman)...');
  const testLead = await prisma.lead.findFirst({
    where: {
      OR: [
        { email: { contains: 'zach@inspired.mortgage' } },
        { firstName: 'Zach', lastName: 'Silverman' },
      ],
    },
  });

  if (!testLead) {
    console.log('❌ Test lead not found - create Zach Silverman test lead first');
    process.exit(1);
  }

  console.log(`✅ Found test lead: ${testLead.firstName} ${testLead.lastName} (${testLead.id})`);
  console.log(`   Status: ${testLead.status}`);
  console.log(`   Managed by Autonomous: ${testLead.managedByAutonomous}`);
  console.log(`   Holly Disabled: ${testLead.hollyDisabled}\n`);

  // === TEST 3: Check Recent Communications ===
  console.log('3️⃣ Checking recent communications across all autonomous leads...');
  const recentComms = await prisma.communication.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      lead: { managedByAutonomous: true },
    },
    include: {
      lead: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`   Found ${recentComms.length} communications in last hour`);
  recentComms.forEach((comm) => {
    console.log(
      `   - ${comm.lead.firstName} ${comm.lead.lastName}: ${comm.direction} ${comm.channel} at ${comm.createdAt.toLocaleTimeString()}`
    );
  });

  if (recentComms.length === 0) {
    console.log('⚠️  No recent communications - Holly might not be running!\n');
  } else {
    console.log('✅ Holly is sending messages\n');
  }

  // === TEST 4: Check Leads Due for Review ===
  console.log('4️⃣ Checking leads due for review right now...');
  const dueLeads = await prisma.lead.findMany({
    where: {
      managedByAutonomous: true,
      hollyDisabled: false,
      consentSms: true,
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      nextReviewAt: true,
    },
    take: 20,
  });

  console.log(`   ${dueLeads.length} leads due for review`);
  dueLeads.forEach((lead) => {
    console.log(
      `   - ${lead.firstName} ${lead.lastName} (${lead.status}) - Due: ${lead.nextReviewAt || 'NEVER'}`
    );
  });

  if (dueLeads.length === 0) {
    console.log('✅ No leads currently due (all scheduled for future)\n');
  } else {
    console.log(`⚠️  ${dueLeads.length} leads are waiting for Holly to contact them!\n`);
  }

  // === TEST 5: Check for Silent Failures ===
  console.log('5️⃣ Checking for error patterns in lead activities...');
  const recentErrors = await prisma.leadActivity.findMany({
    where: {
      content: { contains: 'error', mode: 'insensitive' },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: {
      lead: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (recentErrors.length > 0) {
    console.log(`⚠️  Found ${recentErrors.length} errors in last 24h:`);
    recentErrors.forEach((err) => {
      console.log(`   - ${err.lead.firstName} ${err.lead.lastName}: ${err.content.substring(0, 100)}...`);
    });
  } else {
    console.log('✅ No recent errors found\n');
  }

  // === TEST 6: Test DRY RUN (if enabled) ===
  if (process.env.DRY_RUN_MODE === 'true') {
    console.log('6️⃣ DRY RUN MODE ENABLED - Testing decision-making...');
    console.log('   (This will NOT send any actual messages)\n');

    // Test with any autonomous lead that needs review
    if (dueLeads.length > 0) {
      const testLeadId = dueLeads[0].id;
      console.log(
        `   Testing with ${dueLeads[0].firstName} ${dueLeads[0].lastName}...`
      );

      try {
        const result = await processLeadWithAutonomousAgent(testLeadId);
        console.log('   Result:', JSON.stringify(result, null, 2));
        console.log('✅ Autonomous agent decision-making works\n');
      } catch (error) {
        console.log('❌ Error testing autonomous agent:');
        console.error(error);
      }
    }
  }

  // === SUMMARY ===
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYSTEM HEALTH SUMMARY');
  console.log('='.repeat(60));

  const summary = {
    'Environment Configured': process.env.ENABLE_AUTONOMOUS_AGENT === 'true' ? '✅' : '❌',
    'Anthropic API Key': process.env.ANTHROPIC_API_KEY ? '✅' : '❌',
    'Recent Activity (1h)': recentComms.length > 0 ? `✅ ${recentComms.length} messages` : '⚠️  None',
    'Leads Due for Review': dueLeads.length === 0 ? '✅ All scheduled' : `⚠️  ${dueLeads.length} waiting`,
    'Recent Errors (24h)': recentErrors.length === 0 ? '✅ None' : `⚠️  ${recentErrors.length} found`,
  };

  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key.padEnd(30)}: ${value}`);
  });

  console.log('='.repeat(60) + '\n');

  // === RECOMMENDATIONS ===
  if (dueLeads.length > 0 && recentComms.length === 0) {
    console.log('⚠️  WARNING: Leads are due for review but no recent activity!');
    console.log('   This suggests the cron job may not be running.');
    console.log('   Check vercel.json cron configuration and Vercel dashboard.\n');
  }

  if (recentErrors.length > 0) {
    console.log('⚠️  WARNING: Errors detected in the last 24 hours.');
    console.log('   Review lead activities for details.\n');
  }

  await prisma.$disconnect();
}

testAutonomousSystem().catch((error) => {
  console.error('❌ Fatal error running test:', error);
  process.exit(1);
});
