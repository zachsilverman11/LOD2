/**
 * Holly Performance Analyzer
 *
 * Runs weekly to analyze conversation outcomes and generate new training examples
 * Based on REAL data, not assumptions
 *
 * Usage:
 *   npx tsx scripts/analyze-holly-performance.ts
 *   (Run this every Sunday night to generate learned examples for the next week)
 */

import { prisma } from '../lib/db';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface LearnedPattern {
  scenario: string;
  sampleSize: number;
  successRate: number;
  whatWorked: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItWorked: string[];
  };
  whatDidntWork: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItFailed: string[];
  };
}

async function analyzePerformance() {
  console.log('🔍 Analyzing Holly performance from past 7 days...\n');

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all conversation outcomes from past week
  const outcomes = await prisma.conversationOutcome.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          status: true,
          rawData: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${outcomes.length} conversation outcomes to analyze\n`);

  if (outcomes.length === 0) {
    console.log('⚠️  No outcomes yet - need to wait for data to accumulate');
    return;
  }

  // Group outcomes by lead type and scenario
  const scenarios = groupByScenario(outcomes);

  // Analyze each scenario for patterns
  const learnedPatterns: LearnedPattern[] = [];

  for (const [scenarioName, scenarioOutcomes] of Object.entries(scenarios)) {
    if (scenarioOutcomes.length < 5) {
      console.log(`⏭️  Skipping "${scenarioName}" - only ${scenarioOutcomes.length} samples (need 5+)`);
      continue;
    }

    console.log(`\n📊 Analyzing scenario: ${scenarioName} (${scenarioOutcomes.length} samples)`);

    const pattern = analyzeSingleScenario(scenarioName, scenarioOutcomes);
    if (pattern) {
      learnedPatterns.push(pattern);
      console.log(`   ✅ Success rate: ${pattern.successRate}%`);
      console.log(`   📈 Best approach booking rate: ${pattern.whatWorked.bookingRate}%`);
      console.log(`   📉 Worst approach booking rate: ${pattern.whatDidntWork.bookingRate}%`);
    }
  }

  // Generate learned examples file
  if (learnedPatterns.length > 0) {
    generateLearnedExamplesFile(learnedPatterns);
    console.log(`\n✅ Generated ${learnedPatterns.length} learned patterns!`);
    console.log(`📁 Saved to: lib/holly-learned-examples.ts`);
  } else {
    console.log('\n⚠️  No significant patterns detected yet - need more data');
  }
}

function groupByScenario(outcomes: any[]): Record<string, any[]> {
  const scenarios: Record<string, any[]> = {};

  for (const outcome of outcomes) {
    const rawData = outcome.lead.rawData || {};
    const leadType = rawData.lead_type || rawData.loanType || 'unknown';
    const urgency = rawData.motivation_level || 'general';

    // Create scenario key
    let scenarioKey = '';

    if (urgency === 'I have made an offer to purchase') {
      scenarioKey = 'Purchase - Urgent (Accepted Offer)';
    } else if (leadType.toLowerCase().includes('purchase')) {
      scenarioKey = 'Purchase - General';
    } else if (leadType.toLowerCase().includes('refinance')) {
      scenarioKey = 'Refinance - General';
    } else if (leadType.toLowerCase().includes('renewal')) {
      scenarioKey = 'Renewal - General';
    } else {
      scenarioKey = 'Unknown Lead Type';
    }

    if (!scenarios[scenarioKey]) {
      scenarios[scenarioKey] = [];
    }

    scenarios[scenarioKey].push(outcome);
  }

  return scenarios;
}

function analyzeSingleScenario(scenarioName: string, outcomes: any[]): LearnedPattern | null {
  // Calculate overall success rate
  const bookedCount = outcomes.filter((o) => o.booked).length;
  const engagedCount = outcomes.filter((o) => o.outcome === 'ENGAGED').length;
  const successRate = Math.round(((bookedCount + engagedCount) / outcomes.length) * 100);

  // Find best and worst performing messages
  const messageGroups = groupByMessagePattern(outcomes);

  const sorted = Object.entries(messageGroups)
    .map(([pattern, group]) => {
      const booked = group.filter((o) => o.booked).length;
      const engaged = group.filter((o) => o.outcome === 'ENGAGED').length;
      const bookingRate = Math.round((booked / group.length) * 100);
      const engagementRate = Math.round((engaged / group.length) * 100);

      return {
        pattern,
        group,
        bookingRate,
        engagementRate,
        sampleSize: group.length,
      };
    })
    .filter((g) => g.sampleSize >= 3) // Need at least 3 samples
    .sort((a, b) => b.bookingRate - a.bookingRate);

  if (sorted.length < 2) {
    return null; // Need at least 2 different approaches to compare
  }

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Extract example messages
  const bestMessage = best.group[0].messageSent;
  const worstMessage = worst.group[0].messageSent;

  // Analyze why best worked
  const bestWhyItWorked: string[] = [];
  if (bestMessage.includes('Here\'s') && bestMessage.includes('calendar')) {
    bestWhyItWorked.push('Directed to calendar immediately');
  }
  if (bestMessage.match(/\$\d+/)) {
    bestWhyItWorked.push('Quantified value in dollars');
  }
  if (bestMessage.toLowerCase().includes('quick') || bestMessage.includes('10 min')) {
    bestWhyItWorked.push('Low-friction language (quick/10 min)');
  }
  if (best.bookingRate > worst.bookingRate + 20) {
    bestWhyItWorked.push(`${best.bookingRate - worst.bookingRate}% higher booking rate`);
  }

  // Analyze why worst failed
  const worstWhyItFailed: string[] = [];
  if (worstMessage.includes('When\'s') || worstMessage.includes('What time')) {
    worstWhyItFailed.push('Asked for time instead of directing to calendar');
  }
  if (worstMessage.includes('Greg can call you')) {
    worstWhyItFailed.push('Promised call without booking (broken promise pattern)');
  }
  if (!worstMessage.match(/\$\d+/) && bestMessage.match(/\$\d+/)) {
    worstWhyItFailed.push('Didn\'t quantify value');
  }
  if (worst.bookingRate < 20) {
    worstWhyItFailed.push(`Only ${worst.bookingRate}% booking rate`);
  }

  return {
    scenario: scenarioName,
    sampleSize: outcomes.length,
    successRate,
    whatWorked: {
      message: bestMessage,
      bookingRate: best.bookingRate,
      engagementRate: best.engagementRate,
      whyItWorked: bestWhyItWorked.length > 0 ? bestWhyItWorked : ['Higher conversion rate'],
    },
    whatDidntWork: {
      message: worstMessage,
      bookingRate: worst.bookingRate,
      engagementRate: worst.engagementRate,
      whyItFailed: worstWhyItFailed.length > 0 ? worstWhyItFailed : ['Lower conversion rate'],
    },
  };
}

function groupByMessagePattern(outcomes: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  for (const outcome of outcomes) {
    const message = outcome.messageSent;

    // Create pattern key based on message structure
    let pattern = '';

    if (message.includes('Greg can call you')) {
      pattern = 'promise_call_time';
    } else if (message.includes('Here\'s') && message.includes('calendar')) {
      pattern = 'direct_to_calendar';
    } else if (message.includes('When\'s') || message.includes('What time')) {
      pattern = 'ask_for_time';
    } else if (message.includes('$') && /\d+/.test(message)) {
      pattern = 'quantified_value';
    } else {
      pattern = 'generic';
    }

    if (!groups[pattern]) {
      groups[pattern] = [];
    }

    groups[pattern].push(outcome);
  }

  return groups;
}

function generateLearnedExamplesFile(patterns: LearnedPattern[]) {
  const timestamp = new Date().toLocaleString();

  const fileContent = `/**
 * Holly Learned Examples
 *
 * AUTO-GENERATED from real conversation outcomes
 * Last updated: ${timestamp}
 *
 * These examples are based on actual data from the past 7 days
 * showing which messages led to bookings vs which didn't
 */

export interface LearnedExample {
  scenario: string;
  sampleSize: number;
  successRate: number;
  whatWorked: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItWorked: string[];
  };
  whatDidntWork: {
    message: string;
    bookingRate: number;
    engagementRate: number;
    whyItFailed: string[];
  };
}

export const LEARNED_EXAMPLES: LearnedExample[] = ${JSON.stringify(patterns, null, 2)};

export function getLearnedExamplesForScenario(scenario: string): LearnedExample | null {
  return LEARNED_EXAMPLES.find((ex) => ex.scenario.toLowerCase().includes(scenario.toLowerCase())) || null;
}
`;

  const filePath = join(__dirname, '../lib/holly-learned-examples.ts');
  writeFileSync(filePath, fileContent, 'utf-8');
}

// Run analysis
analyzePerformance()
  .then(() => {
    console.log('\n✨ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  });
