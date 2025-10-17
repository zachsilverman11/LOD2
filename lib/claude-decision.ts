/**
 * Claude Decision Engine
 * Rich context + minimal rules = intelligent decisions
 */

import Anthropic from '@anthropic-ai/sdk';
import { Lead } from '@prisma/client';
import { DealSignals } from './deal-intelligence';
import { HollyDecision } from './safety-guardrails';
import { buildHollyBriefing } from './holly-knowledge-base';

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
  const rawData = lead.rawData as any;
  const firstName = lead.firstName || rawData?.first_name || rawData?.name?.split(' ')[0] || 'there';

  // Recent conversation (last 8 messages for better context)
  const recentMessages =
    lead.communications && lead.communications.length > 0
      ? lead.communications
          .slice(0, 8)
          .map((m: any) => `${m.direction === 'OUTBOUND' ? 'Holly' : firstName}: ${m.content}`)
          .join('\n\n')
      : '(No conversation yet - this will be first contact)';

  // Count touches
  const outboundCount =
    lead.communications?.filter((c: any) => c.direction === 'OUTBOUND').length || 0;
  const inboundCount =
    lead.communications?.filter((c: any) => c.direction === 'INBOUND').length || 0;

  // Days in pipeline
  const daysInPipeline = Math.floor(
    (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Last message from
  let lastMessageFrom: 'holly' | 'lead' | 'none' = 'none';
  if (lead.communications && lead.communications.length > 0) {
    lastMessageFrom = lead.communications[0].direction === 'OUTBOUND' ? 'holly' : 'lead';
  }

  // Build rich context briefing
  const hollyBriefing = buildHollyBriefing({
    leadData: rawData,
    conversationContext: {
      touchNumber: outboundCount + 1,
      hasReplied: inboundCount > 0,
      daysInPipeline,
      messageHistory: recentMessages,
      lastMessageFrom,
    },
    appointments: lead.appointments || [],
    callOutcome: lead.callOutcomes?.[0],
    applicationStatus: {
      started: lead.applicationStartedAt || undefined,
      completed: lead.applicationCompletedAt || undefined,
    },
  });

  const prompt = `${hollyBriefing}

---

## 🎯 YOUR DECISION TASK

**Lead Temperature:** ${signals.temperature} (${signals.engagementTrend})
${signals.contextualUrgency ? `⚠️ **${signals.contextualUrgency}**` : ''}

${signals.reasoningContext}

---

## 💭 THINK LIKE A TOP SALES REP

Analyze this lead and decide your next move:

1. **What's their current state of mind?** (engaged, stalling, losing interest, needs help?)
2. **What do they need right now?** (information, reassurance, push, space?)
3. **What would move them forward?** (not what follows a rule - what actually works)
4. **Should you reach out, wait, or get human help?**

**Critical thinking:**
- Use your knowledge base (programs, conversation principles) as TOOLS, not RULES
- If you've already mentioned something, try a different angle
- Match your message to their situation and engagement level
- Be honest if you're unsure (confidence: low)

---

## 📤 YOUR RESPONSE (JSON only)

\`\`\`json
{
  "thinking": "Your detailed reasoning (2-3 sentences). WHY this action makes sense.",
  "action": "send_sms" | "send_booking_link" | "send_application_link" | "wait" | "escalate",
  "message": "Natural, conversational message (if sending). Use their name. Sound human.",
  "waitHours": 24,
  "nextCheckCondition": "what triggers next review (e.g., 'if they reply OR in 24h')",
  "confidence": "high" | "medium" | "low"
}
\`\`\`

**Focus on conversion, not activity. Quality over quantity.**`;

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
