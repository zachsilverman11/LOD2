/**
 * Test Autonomous Agent with Specific Leads
 *
 * Usage:
 *   npx tsx scripts/test-autonomous-agent.ts "jeffkimh@telus.net" "Mikeyoneofsix@gmail.com"
 *
 * This script:
 * 1. Marks specific test leads as managed by autonomous agent
 * 2. Runs the agent loop in DRY RUN mode
 * 3. Shows what Holly would do (without sending real messages)
 * 4. Displays full decision reasoning
 */

import { prisma } from '../lib/db';
import { runHollyAgentLoop } from '../lib/autonomous-agent';
import { analyzeDealHealth } from '../lib/deal-intelligence';
import { askHollyToDecide } from '../lib/claude-decision';

// Get test lead emails from command line args
const testLeadEmails = process.argv.slice(2);

if (testLeadEmails.length === 0) {
  console.log('❌ No test lead emails provided!');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/test-autonomous-agent.ts "email1@example.com" "email2@example.com"');
  console.log('\nExample:');
  console.log('  npx tsx scripts/test-autonomous-agent.ts "jeffkimh@telus.net" "Mikeyoneofsix@gmail.com"');
  process.exit(1);
}

async function setupTestLeads() {
  console.log('🧪 Setting up test leads for autonomous agent...\n');

  // First, DISABLE all leads from autonomous management
  await prisma.lead.updateMany({
    where: { managedByAutonomous: true },
    data: { managedByAutonomous: false },
  });

  // Then enable ONLY the test leads
  const testLeads = await prisma.lead.findMany({
    where: {
      email: { in: testLeadEmails },
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      appointments: true,
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (testLeads.length === 0) {
    console.log('❌ No leads found with those emails!');
    console.log('Available leads:');
    const allLeads = await prisma.lead.findMany({
      select: { email: true, firstName: true, lastName: true },
      take: 10,
    });
    allLeads.forEach(l => console.log(`  - ${l.email} (${l.firstName} ${l.lastName})`));
    process.exit(1);
  }

  console.log(`✅ Found ${testLeads.length} test lead(s):\n`);

  for (const lead of testLeads) {
    console.log(`📋 ${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`   Status: ${lead.status}`);
    console.log(`   Messages: ${lead.communications.length} total`);
    console.log(`   Last contact: ${lead.lastContactedAt?.toLocaleString() || 'Never'}`);

    // Analyze deal health
    const signals = analyzeDealHealth(lead);
    console.log(`   Temperature: ${signals.temperature} (${signals.engagementTrend})`);
    if (signals.contextualUrgency) {
      console.log(`   ⚠️  ${signals.contextualUrgency}`);
    }
    console.log('');

    // Mark as autonomous and set for immediate review
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        managedByAutonomous: true,
        nextReviewAt: new Date(), // Review immediately
      },
    });
  }

  console.log('✅ Test leads marked for autonomous management\n');
  return testLeads;
}

async function runDetailedTest() {
  console.log('🤖 Running detailed test for each lead...\n');
  console.log('=' .repeat(80));
  console.log('\n');

  const testLeads = await prisma.lead.findMany({
    where: {
      managedByAutonomous: true,
    },
    include: {
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      appointments: true,
      callOutcomes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  for (const lead of testLeads) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TESTING: ${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log('='.repeat(80));

    // Analyze
    const signals = analyzeDealHealth(lead);

    console.log('\n📊 DEAL HEALTH ANALYSIS:');
    console.log(`   Temperature: ${signals.temperature}`);
    console.log(`   Engagement Trend: ${signals.engagementTrend}`);
    console.log(`   Last Reply Tone: ${signals.sentimentSignals.lastReplyTone}`);
    console.log(`   Questions Asked: ${signals.sentimentSignals.questionCount}`);
    console.log(`   Objection Detected: ${signals.sentimentSignals.objectionDetected ? 'YES ⚠️' : 'No'}`);
    console.log(`   Motivation Level: ${signals.motivationLevel}`);
    if (signals.contextualUrgency) {
      console.log(`   ⚠️  URGENCY: ${signals.contextualUrgency}`);
    }
    console.log(`   Next Review: ${signals.nextReviewHours}h from now`);

    console.log('\n💬 RECENT CONVERSATION:');
    const recent = lead.communications.slice(0, 3);
    if (recent.length === 0) {
      console.log('   (No conversation yet - first contact)');
    } else {
      recent.forEach((msg, i) => {
        const role = msg.direction === 'OUTBOUND' ? 'Holly' : lead.firstName;
        const preview = msg.content.length > 80
          ? msg.content.substring(0, 77) + '...'
          : msg.content;
        console.log(`   ${role}: ${preview}`);
      });
    }

    console.log('\n🧠 ASKING CLAUDE TO DECIDE...');

    try {
      const decision = await askHollyToDecide(lead, signals);

      console.log('\n✅ HOLLY\'S DECISION:');
      console.log(`   Action: ${decision.action.toUpperCase()}`);
      console.log(`   Confidence: ${decision.confidence.toUpperCase()}`);
      console.log(`   Thinking: "${decision.thinking}"`);

      if (decision.message) {
        console.log(`\n   📱 Would send this message:`);
        console.log(`   ┌${'─'.repeat(78)}┐`);
        decision.message.split('\n').forEach(line => {
          console.log(`   │ ${line.padEnd(76)} │`);
        });
        console.log(`   └${'─'.repeat(78)}┘`);
      }

      if (decision.waitHours) {
        console.log(`\n   ⏰ Wait Duration: ${decision.waitHours} hours`);
      }

      if (decision.nextCheckCondition) {
        console.log(`   📅 Next Check: ${decision.nextCheckCondition}`);
      }

      if (decision.suggestedAction) {
        console.log(`   💡 Suggested Action: ${decision.suggestedAction}`);
      }

      // Show what would happen in production
      console.log('\n📝 WHAT WOULD HAPPEN IN PRODUCTION:');
      if (decision.action === 'wait') {
        console.log(`   ⏸️  Holly would wait ${decision.waitHours}h, then re-evaluate`);
      } else if (decision.action === 'escalate') {
        console.log(`   🚨 Slack alert sent to team`);
        console.log(`   📌 Note added to lead activity`);
        console.log(`   ⏸️  Won't auto-follow-up for 48h (human handles)`);
      } else {
        console.log(`   📤 SMS would be sent to ${lead.phone}`);
        console.log(`   📊 Lead activity logged`);
        console.log(`   ⏰ Next review scheduled in ${signals.nextReviewHours}h`);
      }

    } catch (error) {
      console.log('\n❌ ERROR:', error);
    }

    console.log('\n');
  }

  console.log('='.repeat(80));
  console.log('\n✅ Test complete!\n');
}

async function cleanup() {
  console.log('🧹 Cleaning up test configuration...');

  // Disable autonomous management for test leads
  await prisma.lead.updateMany({
    where: { managedByAutonomous: true },
    data: {
      managedByAutonomous: false,
      nextReviewAt: null,
    },
  });

  console.log('✅ Test leads returned to normal state\n');
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                 AUTONOMOUS HOLLY AGENT TESTER                  ║');
  console.log('║                      Phase 2: Dry Run Mode                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Check environment
  if (process.env.DRY_RUN_MODE !== 'true') {
    console.log('⚠️  WARNING: DRY_RUN_MODE is not set to "true"!');
    console.log('This script is safest with DRY_RUN_MODE=true\n');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY not found in environment!');
    console.log('Add it to your .env file:\n');
    console.log('ANTHROPIC_API_KEY="sk-ant-..."');
    process.exit(1);
  }

  try {
    // Step 1: Setup test leads
    await setupTestLeads();

    // Step 2: Run detailed test
    await runDetailedTest();

    // Step 3: Cleanup
    await cleanup();

  } catch (error) {
    console.error('💥 Error:', error);
    await cleanup();
    process.exit(1);
  }
}

main();
