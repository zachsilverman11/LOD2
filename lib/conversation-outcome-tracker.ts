/**
 * Conversation Outcome Tracker
 *
 * Automatically tracks outcomes of Holly's conversations for continuous learning
 * Runs in background after each message to analyze lead response patterns
 */

import { prisma } from './db';
import { ConversationOutcomeType, ConversationSentiment } from '@/app/generated/prisma';

export interface OutcomeTracking {
  leadId: string;
  messageSent: string;
  hollyDecision: any;
}

/**
 * Track conversation outcome after Holly sends a message
 * This runs AFTER the message is sent to monitor what happens next
 */
export async function trackConversationOutcome(tracking: OutcomeTracking) {
  const { leadId, messageSent, hollyDecision } = tracking;

  // Wait 4 hours to see if lead responds
  const RESPONSE_WINDOW = 4 * 60 * 60 * 1000; // 4 hours in ms

  setTimeout(async () => {
    try {
      await analyzeOutcome(leadId, messageSent, hollyDecision);
    } catch (error) {
      console.error(`[Outcome Tracker] Error analyzing outcome for lead ${leadId}:`, error);
    }
  }, RESPONSE_WINDOW);

  console.log(`[Outcome Tracker] Will check lead ${leadId} outcome in 4 hours`);
}

/**
 * Analyze conversation outcome after response window
 */
async function analyzeOutcome(leadId: string, messageSent: string, hollyDecision: any) {
  // Fetch lead with latest communications
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      communications: {
        where: {
          createdAt: {
            gte: hollyDecision.sentAt || new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h window
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      appointments: {
        where: {
          createdAt: {
            gte: hollyDecision.sentAt || new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  if (!lead) {
    console.error(`[Outcome Tracker] Lead ${leadId} not found`);
    return;
  }

  // Determine outcome
  let outcome: ConversationOutcomeType;
  let sentiment: ConversationSentiment | null = null;
  let leadResponse: string | null = null;
  let responseTime: number | null = null;
  let booked = false;

  // Check if they booked a call
  if (lead.appointments.length > 0) {
    outcome = ConversationOutcomeType.BOOKED;
    booked = true;
  }
  // Check if they replied
  else {
    const inboundMessages = lead.communications.filter((c) => c.direction === 'INBOUND');

    if (inboundMessages.length > 0) {
      const reply = inboundMessages[0];
      leadResponse = reply.content;

      // Calculate response time
      const sentTime = hollyDecision.sentAt || new Date();
      responseTime = Math.floor((reply.createdAt.getTime() - sentTime.getTime()) / 60000); // minutes

      // Determine sentiment from reply
      const lowerReply = reply.content.toLowerCase();

      if (
        lowerReply.includes('stop') ||
        lowerReply.includes('unsubscribe') ||
        lowerReply.includes('remove me')
      ) {
        outcome = ConversationOutcomeType.OPTED_OUT;
        sentiment = ConversationSentiment.NEGATIVE;
      } else if (
        lowerReply.includes('not interested') ||
        lowerReply.includes('no thanks') ||
        lowerReply.includes('leave me alone')
      ) {
        outcome = ConversationOutcomeType.ENGAGED;
        sentiment = ConversationSentiment.NEGATIVE;
      } else if (
        lowerReply.includes('?') ||
        lowerReply.includes('yes') ||
        lowerReply.includes('sure') ||
        lowerReply.includes('sounds good') ||
        lowerReply.includes('okay')
      ) {
        outcome = ConversationOutcomeType.ENGAGED;
        sentiment = ConversationSentiment.POSITIVE;
      } else {
        outcome = ConversationOutcomeType.ENGAGED;
        sentiment = ConversationSentiment.NEUTRAL;
      }
    } else {
      // No response after 4 hours
      outcome = ConversationOutcomeType.GHOSTED;
    }
  }

  // Create outcome record
  await prisma.conversationOutcome.create({
    data: {
      leadId,
      messageSent,
      leadResponse,
      outcome,
      sentiment,
      hollyDecision,
      responseTime,
      booked,
    },
  });

  console.log(
    `[Outcome Tracker] ✅ Tracked outcome for lead ${leadId}: ${outcome}${sentiment ? ` (${sentiment})` : ''}`
  );
}

/**
 * Manually track outcome for a specific message (useful for backfilling)
 */
export async function trackOutcomeNow(leadId: string, messageSent: string, hollyDecision: any) {
  await analyzeOutcome(leadId, messageSent, hollyDecision);
}
