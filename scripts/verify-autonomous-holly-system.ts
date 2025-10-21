/**
 * Comprehensive Autonomous Holly System Verification
 *
 * Checks all components are working correctly before deployment
 */

import { prisma } from '../lib/db';
import { runHollyAgentLoop } from '../lib/autonomous-agent';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: CheckResult[] = [];

async function verify() {
  console.log('🔍 AUTONOMOUS HOLLY SYSTEM VERIFICATION\n');
  console.log('=' .repeat(60));
  console.log('\n');

  // 1. Database Schema Check
  await checkDatabaseSchema();

  // 2. Environment Variables Check
  await checkEnvironmentVariables();

  // 3. Cron Configuration Check
  await checkCronConfiguration();

  // 4. Webhook Routing Check
  await checkWebhookRouting();

  // 5. Training System Check
  await checkTrainingSystem();

  // 6. Autonomous Leads Check
  await checkAutonomousLeads();

  // 7. Stage Progression Logic Check
  await checkStageProgression();

  // 8. Conversation Outcome Tracking Check
  await checkOutcomeTracking();

  // Print Results
  console.log('\n');
  console.log('=' .repeat(60));
  console.log('\n📊 VERIFICATION RESULTS:\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️ ';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });

  console.log('=' .repeat(60));
  console.log(`\n✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⚠️  WARNINGS: ${warnings}\n`);

  if (failed > 0) {
    console.log('🚨 DEPLOYMENT BLOCKED - Fix failures before deploying!\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  WARNINGS DETECTED - Review before deploying\n');
  } else {
    console.log('🎉 ALL CHECKS PASSED - Ready to deploy!\n');
  }
}

async function checkDatabaseSchema() {
  console.log('1️⃣  Checking Database Schema...');

  try {
    // Check if ConversationOutcome table exists
    const outcome = await prisma.conversationOutcome.findFirst();
    results.push({
      name: 'ConversationOutcome Table',
      status: 'PASS',
      message: 'Table exists and is accessible',
    });
  } catch (error) {
    results.push({
      name: 'ConversationOutcome Table',
      status: 'FAIL',
      message: 'Table not found or not accessible',
      details: error instanceof Error ? error.message : String(error),
    });
  }

  // Check if managedByAutonomous column exists
  const autonomousLeads = await prisma.lead.findMany({
    where: { managedByAutonomous: true },
    take: 1,
  });

  results.push({
    name: 'managedByAutonomous Column',
    status: 'PASS',
    message: `Column exists. Found ${autonomousLeads.length > 0 ? 'autonomous' : 'no'} leads`,
  });

  console.log('   ✓ Database schema check complete\n');
}

async function checkEnvironmentVariables() {
  console.log('2️⃣  Checking Environment Variables...');

  const requiredVars = [
    'ANTHROPIC_API_KEY',
    'ENABLE_AUTONOMOUS_AGENT',
    'DATABASE_URL',
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      results.push({
        name: `ENV: ${varName}`,
        status: 'PASS',
        message: 'Set correctly',
      });
    } else {
      results.push({
        name: `ENV: ${varName}`,
        status: 'FAIL',
        message: 'Not set or empty',
      });
    }
  }

  // Check DRY_RUN_MODE
  const dryRunMode = process.env.DRY_RUN_MODE === 'true';
  if (dryRunMode) {
    results.push({
      name: 'ENV: DRY_RUN_MODE',
      status: 'WARNING',
      message: 'Set to TRUE - Holly will not send actual messages!',
    });
  } else {
    results.push({
      name: 'ENV: DRY_RUN_MODE',
      status: 'PASS',
      message: 'Set to FALSE - Live mode enabled',
    });
  }

  console.log('   ✓ Environment variables check complete\n');
}

async function checkCronConfiguration() {
  console.log('3️⃣  Checking Cron Configuration...');

  const fs = await import('fs');
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf-8'));

  const hasAutonomousHollyCron = vercelConfig.crons?.some(
    (cron: any) => cron.path === '/api/cron/autonomous-holly'
  );

  if (hasAutonomousHollyCron) {
    const cronConfig = vercelConfig.crons.find(
      (cron: any) => cron.path === '/api/cron/autonomous-holly'
    );
    results.push({
      name: 'Autonomous Holly Cron',
      status: 'PASS',
      message: `Configured in vercel.json with schedule: ${cronConfig.schedule}`,
    });
  } else {
    results.push({
      name: 'Autonomous Holly Cron',
      status: 'FAIL',
      message: 'Not found in vercel.json cron configuration',
    });
  }

  console.log('   ✓ Cron configuration check complete\n');
}

async function checkWebhookRouting() {
  console.log('4️⃣  Checking Webhook Routing...');

  const fs = await import('fs');

  // Check Twilio webhook uses autonomous agent
  const twilioWebhook = fs.readFileSync('app/api/webhooks/twilio/route.ts', 'utf-8');
  if (twilioWebhook.includes('processLeadWithAutonomousAgent')) {
    results.push({
      name: 'Twilio Webhook → Autonomous Agent',
      status: 'PASS',
      message: 'Routes SMS replies through autonomous agent',
    });
  } else {
    results.push({
      name: 'Twilio Webhook → Autonomous Agent',
      status: 'FAIL',
      message: 'Still using old handleConversation system',
    });
  }

  // Check leads-on-demand webhook uses autonomous agent
  const lodWebhook = fs.readFileSync('app/api/webhooks/leads-on-demand/route.ts', 'utf-8');
  if (lodWebhook.includes('processLeadWithAutonomousAgent')) {
    results.push({
      name: 'Leads-on-Demand Webhook → Autonomous Agent',
      status: 'PASS',
      message: 'Routes new leads through autonomous agent',
    });
  } else {
    results.push({
      name: 'Leads-on-Demand Webhook → Autonomous Agent',
      status: 'FAIL',
      message: 'Still using old handleConversation system',
    });
  }

  console.log('   ✓ Webhook routing check complete\n');
}

async function checkTrainingSystem() {
  console.log('5️⃣  Checking 6-Layer Training System...');

  const fs = await import('fs');
  const claudeDecision = fs.readFileSync('lib/claude-decision.ts', 'utf-8');

  // Check for all 6 layers
  const layers = [
    { name: 'Lead Journey Context', check: 'getLeadJourneyIntro' },
    { name: 'Behavioral Intelligence', check: 'analyzeReply' },
    { name: 'Sales Psychology', check: 'SALES_PSYCHOLOGY' },
    { name: 'Training Examples', check: 'getRelevantExamples' },
    { name: 'Learned Examples', check: 'LEARNED_EXAMPLES' },
    { name: 'Extended Thinking', check: 'THINK STEP-BY-STEP' },
  ];

  layers.forEach(layer => {
    if (claudeDecision.includes(layer.check)) {
      results.push({
        name: `Layer: ${layer.name}`,
        status: 'PASS',
        message: 'Integrated into decision engine',
      });
    } else {
      results.push({
        name: `Layer: ${layer.name}`,
        status: 'FAIL',
        message: 'Not found in claude-decision.ts',
      });
    }
  });

  console.log('   ✓ Training system check complete\n');
}

async function checkAutonomousLeads() {
  console.log('6️⃣  Checking Autonomous Leads...');

  const totalLeads = await prisma.lead.count({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      consentSms: true,
    },
  });

  const autonomousLeads = await prisma.lead.count({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      consentSms: true,
      managedByAutonomous: true,
    },
  });

  const percentage = totalLeads > 0 ? Math.round((autonomousLeads / totalLeads) * 100) : 0;

  results.push({
    name: 'Autonomous Lead Coverage',
    status: percentage > 0 ? 'PASS' : 'WARNING',
    message: `${autonomousLeads} out of ${totalLeads} active leads (${percentage}%) managed by autonomous agent`,
  });

  // Check how many leads are due for review
  const dueForReview = await prisma.lead.count({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      consentSms: true,
      managedByAutonomous: true,
      OR: [
        { nextReviewAt: null },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
  });

  results.push({
    name: 'Leads Due for Review',
    status: 'PASS',
    message: `${dueForReview} leads ready for autonomous agent review`,
  });

  console.log('   ✓ Autonomous leads check complete\n');
}

async function checkStageProgression() {
  console.log('7️⃣  Checking Stage Progression Logic...');

  const fs = await import('fs');
  const claudeDecision = fs.readFileSync('lib/claude-decision.ts', 'utf-8');

  // Check if stage progression instructions exist
  if (claudeDecision.includes('CONTACTED → ENGAGED') || claudeDecision.includes('move_stage')) {
    results.push({
      name: 'Stage Progression Training',
      status: 'PASS',
      message: 'Instructions for moving leads between stages present',
    });
  } else {
    results.push({
      name: 'Stage Progression Training',
      status: 'WARNING',
      message: 'Stage progression instructions may be missing',
    });
  }

  console.log('   ✓ Stage progression check complete\n');
}

async function checkOutcomeTracking() {
  console.log('8️⃣  Checking Conversation Outcome Tracking...');

  const fs = await import('fs');
  const autonomousAgent = fs.readFileSync('lib/autonomous-agent.ts', 'utf-8');

  if (autonomousAgent.includes('trackConversationOutcome')) {
    results.push({
      name: 'Outcome Tracking Integration',
      status: 'PASS',
      message: 'Autonomous agent tracks conversation outcomes',
    });
  } else {
    results.push({
      name: 'Outcome Tracking Integration',
      status: 'FAIL',
      message: 'Outcome tracking not integrated into autonomous agent',
    });
  }

  // Check if analysis script exists
  if (fs.existsSync('scripts/analyze-holly-performance.ts')) {
    results.push({
      name: 'Performance Analysis Script',
      status: 'PASS',
      message: 'Weekly analysis script exists',
    });
  } else {
    results.push({
      name: 'Performance Analysis Script',
      status: 'WARNING',
      message: 'Analysis script not found',
    });
  }

  console.log('   ✓ Outcome tracking check complete\n');
}

// Run verification
verify()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ VERIFICATION FAILED WITH ERROR:\n');
    console.error(error);
    process.exit(1);
  });
