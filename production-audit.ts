/**
 * Production Readiness Audit
 * Comprehensive check of all systems before going live
 */

const PRODUCTION_URL = 'https://lod2.vercel.app';

console.log('🔍 PRODUCTION READINESS AUDIT');
console.log('═══════════════════════════════════════════════════════════\n');

interface AuditResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
  }>;
}

const results: AuditResult[] = [];

// 1. Environment Variables Check
async function checkEnvironmentVariables() {
  console.log('📋 1. Environment Variables');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  // Critical env vars
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'SENDGRID_API_KEY',
    'OPENAI_API_KEY',
    'SLACK_WEBHOOK_URL',
    'PIPEDRIVE_API_TOKEN',
    'PIPEDRIVE_COMPANY_DOMAIN',
    'CAL_COM_BOOKING_URL',
    'APPLICATION_URL',
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      checks.push({
        name: varName,
        status: 'PASS' as const,
        message: `✅ Configured (${value.substring(0, 10)}...)`,
      });
    } else {
      checks.push({
        name: varName,
        status: 'FAIL' as const,
        message: '❌ Missing',
      });
    }
  }

  results.push({ category: 'Environment Variables', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 2. API Endpoints Check
async function checkAPIEndpoints() {
  console.log('📋 2. API Endpoints');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];
  const endpoints = [
    '/api/leads',
    '/api/analytics/funnel',
    '/api/analytics/targets',
    '/api/webhooks/leads-on-demand',
    '/api/webhooks/finmo',
    '/api/webhooks/calcom',
    '/api/webhooks/twilio',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${PRODUCTION_URL}${endpoint}`, {
        method: endpoint.includes('webhook') ? 'GET' : 'GET',
      });

      if (response.status === 200 || response.status === 405) {
        checks.push({
          name: endpoint,
          status: 'PASS' as const,
          message: `✅ Accessible (${response.status})`,
        });
      } else {
        checks.push({
          name: endpoint,
          status: 'WARNING' as const,
          message: `⚠️  Status ${response.status}`,
        });
      }
    } catch (error) {
      checks.push({
        name: endpoint,
        status: 'FAIL' as const,
        message: '❌ Unreachable',
      });
    }
  }

  results.push({ category: 'API Endpoints', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 3. Database Schema Check
async function checkDatabaseSchema() {
  console.log('📋 3. Database Schema');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  try {
    const { prisma } = await import('./lib/db');

    // Check LeadStatus enum values
    const leads = await prisma.lead.findMany({ take: 1 });
    checks.push({
      name: 'Database Connection',
      status: 'PASS' as const,
      message: '✅ Connected successfully',
    });

    // Check for DEALS_WON status
    const dealsWonLeads = await prisma.lead.findMany({
      where: { status: 'DEALS_WON' },
      take: 1,
    });

    checks.push({
      name: 'DEALS_WON Status',
      status: 'PASS' as const,
      message: '✅ Enum value exists',
    });

    // Check AnalyticsTarget table
    const targets = await prisma.analyticsTarget.findFirst();
    checks.push({
      name: 'AnalyticsTarget Table',
      status: 'PASS' as const,
      message: targets ? '✅ Table exists with data' : '⚠️  Table exists (no data yet)',
    });

    await prisma.$disconnect();
  } catch (error) {
    checks.push({
      name: 'Database',
      status: 'FAIL' as const,
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`,
    });
  }

  results.push({ category: 'Database Schema', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 4. Integration Tests
async function checkIntegrations() {
  console.log('📋 4. External Integrations');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  // Pipedrive
  try {
    const token = process.env.PIPEDRIVE_API_TOKEN || '2b211909afd7f9f3614f582af4a97a3e921a3efb';
    const company = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'inspiredmortgage';

    const response = await fetch(
      `https://${company}.pipedrive.com/v1/users/me?api_token=${token}`
    );

    if (response.ok) {
      const data = await response.json();
      checks.push({
        name: 'Pipedrive API',
        status: 'PASS' as const,
        message: `✅ Connected as ${data.data.name}`,
      });
    } else {
      checks.push({
        name: 'Pipedrive API',
        status: 'FAIL' as const,
        message: `❌ Status ${response.status}`,
      });
    }
  } catch (error) {
    checks.push({
      name: 'Pipedrive API',
      status: 'FAIL' as const,
      message: '❌ Connection failed',
    });
  }

  results.push({ category: 'External Integrations', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 5. Pipeline Stages Check
async function checkPipelineStages() {
  console.log('📋 5. Pipeline Configuration');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/analytics/funnel`);
    const data = await response.json();

    const expectedStages = [
      'NEW',
      'CONTACTED',
      'ENGAGED',
      'CALL_SCHEDULED',
      'CALL_COMPLETED',
      'APPLICATION_STARTED',
      'CONVERTED',
      'DEALS_WON',
      'NURTURING',
      'LOST',
    ];

    const actualStages = data.data.funnel.map((s: any) => s.stage);

    for (const stage of expectedStages) {
      if (actualStages.includes(stage)) {
        checks.push({
          name: stage,
          status: 'PASS' as const,
          message: '✅ Present in pipeline',
        });
      } else {
        checks.push({
          name: stage,
          status: 'FAIL' as const,
          message: '❌ Missing from pipeline',
        });
      }
    }

    // Check if targets exist
    if (data.data.targets) {
      checks.push({
        name: 'Analytics Targets',
        status: 'PASS' as const,
        message: '✅ Configured and returned by API',
      });
    }
  } catch (error) {
    checks.push({
      name: 'Pipeline Check',
      status: 'FAIL' as const,
      message: '❌ Failed to fetch funnel data',
    });
  }

  results.push({ category: 'Pipeline Configuration', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 6. Holly AI Configuration
async function checkHollyAI() {
  console.log('📋 6. Holly AI Configuration');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  // Check if anti-repetition rules are in place
  const aiConfigPath = './lib/ai-conversation-enhanced.ts';
  try {
    const fs = await import('fs');
    const content = fs.readFileSync(aiConfigPath, 'utf-8');

    if (content.includes('CRITICAL ANTI-REPETITION RULES')) {
      checks.push({
        name: 'Anti-Repetition Rules',
        status: 'PASS' as const,
        message: '✅ Configured',
      });
    }

    if (content.includes('NO EMOJIS')) {
      checks.push({
        name: 'No Emoji Policy',
        status: 'PASS' as const,
        message: '✅ Configured',
      });
    }

    if (!content.includes('Reply STOP to opt out')) {
      checks.push({
        name: 'No Unsubscribe Text',
        status: 'PASS' as const,
        message: '✅ Removed from messages',
      });
    }
  } catch (error) {
    checks.push({
      name: 'AI Configuration',
      status: 'WARNING' as const,
      message: '⚠️  Could not verify',
    });
  }

  results.push({ category: 'Holly AI Configuration', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// 7. Data Audit
async function checkCurrentData() {
  console.log('📋 7. Current Data Status');
  console.log('───────────────────────────────────────────────────────────\n');

  const checks = [];

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/leads`);
    const leads = await response.json();

    checks.push({
      name: 'Total Leads',
      status: 'WARNING' as const,
      message: `⚠️  ${leads.length} test leads in database (recommend cleanup)`,
    });

    const testLeads = leads.filter((l: any) =>
      l.email.includes('test') ||
      l.email.includes('example.com') ||
      l.email.includes('inspired.mortgage')
    );

    checks.push({
      name: 'Test Leads',
      status: 'WARNING' as const,
      message: `⚠️  ${testLeads.length} test leads identified`,
    });
  } catch (error) {
    checks.push({
      name: 'Data Check',
      status: 'FAIL' as const,
      message: '❌ Could not fetch leads',
    });
  }

  results.push({ category: 'Current Data Status', checks });
  checks.forEach(c => console.log(`${c.message} ${c.name}`));
  console.log('\n');
}

// Run all checks
async function runAudit() {
  await checkEnvironmentVariables();
  await checkAPIEndpoints();
  await checkDatabaseSchema();
  await checkIntegrations();
  await checkPipelineStages();
  await checkHollyAI();
  await checkCurrentData();

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  let totalPass = 0;
  let totalFail = 0;
  let totalWarning = 0;

  results.forEach(category => {
    category.checks.forEach(check => {
      if (check.status === 'PASS') totalPass++;
      if (check.status === 'FAIL') totalFail++;
      if (check.status === 'WARNING') totalWarning++;
    });
  });

  console.log(`✅ Passed:   ${totalPass}`);
  console.log(`❌ Failed:   ${totalFail}`);
  console.log(`⚠️  Warnings: ${totalWarning}`);
  console.log('');

  if (totalFail === 0 && totalWarning <= 2) {
    console.log('🎉 PRODUCTION READY!');
    console.log('System is ready to accept live leads.\n');
    console.log('⚠️  RECOMMENDED: Clean up test data before going live.');
  } else if (totalFail === 0) {
    console.log('✅ MOSTLY READY');
    console.log('System is functional but has warnings.\n');
    console.log('Review warnings above before going live.');
  } else {
    console.log('❌ NOT READY');
    console.log('Critical issues detected. Review failures above.');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

runAudit().catch(console.error);
