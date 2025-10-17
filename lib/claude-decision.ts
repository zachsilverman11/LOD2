/**
 * Claude Decision Engine
 * Minimal, rule-free prompt that trusts Claude's intelligence
 */

import Anthropic from '@anthropic-ai/sdk';
import { Lead } from '@prisma/client';
import { DealSignals } from './deal-intelligence';
import { HollyDecision } from './safety-guardrails';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askHollyToDecide(
  lead: Lead & {
    communications?: any[];
    appointments?: any[];
    callOutcomes?: any[];
  },
  signals: DealSignals
): Promise<HollyDecision> {
  // Build minimal context
  const rawData = lead.rawData as any;
  const firstName = lead.firstName || rawData?.name?.split(' ')[0] || 'there';

  // Recent conversation (last 5 messages)
  const recentMessages =
    lead.communications
      ?.slice(0, 5)
      .map(
        (m: any) =>
          `${m.direction === 'OUTBOUND' ? 'You' : firstName}: ${m.content}`
      )
      .join('\n\n') || 'No conversation yet - first contact';

  // Call outcome context (if exists)
  const callOutcome = lead.callOutcomes?.[0];
  const callContext = callOutcome
    ? `
## Recent Call Outcome
Advisor: ${callOutcome.advisorName}
Result: ${callOutcome.outcome}
${callOutcome.notes ? `Notes: ${callOutcome.notes}` : ''}
`
    : '';

  // Build lead summary
  const leadSummary = buildLeadSummary(rawData, lead);

  const prompt = `You are Holly, an expert mortgage sales agent reviewing your pipeline.

## Current Situation
Lead: ${firstName} ${lead.lastName || ''}
Temperature: **${signals.temperature}** (${signals.engagementTrend})
${signals.contextualUrgency ? `⚠️ ${signals.contextualUrgency}` : ''}

${signals.reasoningContext}

${callContext}

${leadSummary}

## Recent Conversation
${recentMessages}

## Your Task
Analyze this lead and decide your next move.

Think through:
1. What's their current state of mind?
2. Are they moving forward, stalling, or losing interest?
3. What would a top sales rep do right now?
4. Should you reach out, wait, or escalate to human?

Respond with JSON:
{
  "thinking": "Your detailed reasoning (2-3 sentences)",
  "action": "send_sms" | "send_booking_link" | "send_application_link" | "wait" | "escalate",
  "message": "Natural, brief message (if sending)",
  "waitHours": 24,
  "nextCheckCondition": "if they reply OR in 24h",
  "confidence": "high" | "medium" | "low"
}

Be honest - if you're unsure, say so. Focus on conversion, not activity.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = textContent.text;
    const jsonMatch =
      jsonText.match(/```json\n([\s\S]*?)\n```/) || jsonText.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const decision: HollyDecision = JSON.parse(jsonText);

    // Log decision for debugging
    console.log(
      `[Claude] ${firstName}: ${decision.thinking} → ${decision.action} (confidence: ${decision.confidence})`
    );

    return decision;
  } catch (error) {
    console.error('[Claude] Error getting decision:', error);

    // Fallback decision on error: wait and retry
    return {
      thinking: `API error occurred - will retry later: ${error instanceof Error ? error.message : 'Unknown error'}`,
      action: 'wait',
      waitHours: 2,
      confidence: 'low',
    };
  }
}

// Helper: Build concise lead summary
function buildLeadSummary(rawData: any, lead: Lead): string {
  const loanType = rawData?.loanType || rawData?.lead_type || 'unknown';
  const isPurchase = loanType === 'purchase' || loanType === 'Home Purchase';
  const isRefinance = loanType === 'refinance' || loanType === 'Refinance';
  const isRenewal = loanType === 'renewal' || loanType === 'Renewal';

  let summary = `Loan Type: ${loanType}\n`;

  if (isPurchase) {
    summary += `Purchase Price: $${rawData?.purchasePrice || rawData?.home_value || 'unknown'}\n`;
    summary += `Down Payment: $${rawData?.downPayment || rawData?.down_payment || 'unknown'}\n`;
    if (rawData?.motivation_level) {
      summary += `Urgency: ${rawData.motivation_level}\n`;
    }
  } else if (isRefinance) {
    summary += `Property Value: $${rawData?.purchasePrice || rawData?.home_value || 'unknown'}\n`;
    if (rawData?.withdraw_amount && parseInt(rawData.withdraw_amount) > 0) {
      summary += `Cash Out: $${rawData.withdraw_amount}\n`;
    }
    if (rawData?.lender) {
      summary += `Current Lender: ${rawData.lender}\n`;
    }
  } else if (isRenewal) {
    if (rawData?.balance) {
      summary += `Current Balance: $${rawData.balance}\n`;
    }
    if (rawData?.timeframe) {
      summary += `Timeline: ${rawData.timeframe}\n`;
    }
  }

  if (rawData?.creditScore) {
    summary += `Credit Score: ${rawData.creditScore}\n`;
  }

  if (lead.applicationStartedAt && !lead.applicationCompletedAt) {
    summary += `⚠️ Application started but not completed\n`;
  }

  return summary;
}
