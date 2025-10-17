/**
 * Simulate how autonomous Holly would handle a lead at different stages
 * Shows decision-making at each point in the conversation
 */

import { prisma } from '@/lib/db';
import { analyzeDealHealth } from '@/lib/deal-intelligence';
import { askHollyToDecide } from '@/lib/claude-decision';
import { validateDecision } from '@/lib/safety-guardrails';

async function simulateAutonomousJourney(email: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { email },
      include: {
        communications: {
          orderBy: { createdAt: 'desc' },
        },
        appointments: {
          orderBy: { createdAt: 'desc' },
        },
        callOutcomes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      console.log(`❌ Lead not found: ${email}`);
      return;
    }

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         AUTONOMOUS HOLLY: DECISION SIMULATION                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`Lead: ${lead.firstName} ${lead.lastName}`);
    console.log(`Email: ${lead.email}\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Simulate decisions at key stages
    const stages = [
      {
        name: 'Stage 1: First Contact (No messages yet)',
        messages: [],
      },
      {
        name: `Stage 2: After First Reply (${lead.communications.filter((c) => c.direction === 'INBOUND')[0]?.content.substring(0, 50) || 'N/A'}...)`,
        messages: lead.communications.slice(0, 2).reverse(), // First outbound + first inbound
      },
      {
        name: 'Stage 3: Mid-Conversation (Current state)',
        messages: lead.communications.slice(0, 4).reverse(), // All messages so far
      },
    ];

    for (const stage of stages) {
      console.log(`## ${stage.name}\n`);

      // Create a temporary lead object with only messages up to this stage
      const stageBasedLead = {
        ...lead,
        communications: stage.messages,
      };

      // Analyze deal health at this stage
      const signals = analyzeDealHealth(stageBasedLead as any);

      console.log(`📊 Deal Signals:`);
      console.log(`   Temperature: ${signals.temperature}`);
      console.log(`   Engagement: ${signals.engagementTrend}`);
      console.log(`   Messages so far: ${stage.messages.length}`);
      console.log('');

      // Get Holly's decision
      console.log(`🤖 Asking autonomous Holly to decide...\n`);

      const decision = await askHollyToDecide(stageBasedLead as any, signals);

      // Validate decision
      const validation = validateDecision(decision, {
        lead: stageBasedLead as any,
        signals,
      });

      console.log(`💭 Holly's Thinking:`);
      console.log(`   "${decision.thinking}"\n`);

      console.log(`✅ Decision: ${decision.action.toUpperCase()}`);
      console.log(`   Confidence: ${decision.confidence}`);

      if (decision.message) {
        console.log(`\n📱 Message Holly would send:`);
        console.log(`   ┌${'─'.repeat(70)}┐`);
        const lines = decision.message.match(/.{1,68}/g) || [decision.message];
        lines.forEach((line) => {
          console.log(`   │ ${line.padEnd(68)} │`);
        });
        console.log(`   └${'─'.repeat(70)}┘`);
      }

      console.log(`\n⏰ Next review: ${decision.waitHours || signals.nextReviewHours}h`);

      if (!validation.isValid) {
        console.log(`\n⚠️  Safety Guardrails Blocked:`);
        validation.errors.forEach((err) => console.log(`   - ${err}`));
      }

      if (validation.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        validation.warnings.forEach((warn) => console.log(`   - ${warn}`));
      }

      console.log('\n═══════════════════════════════════════════════════════════════\n');
    }

    console.log('✅ Simulation complete!\n');
  } catch (error) {
    console.error('Error simulating journey:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/simulate-autonomous-journey.ts email@example.com');
  process.exit(1);
}

simulateAutonomousJourney(email);
