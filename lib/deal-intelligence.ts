/**
 * Deal Intelligence Engine
 * Analyzes lead health and engagement to inform Holly's decision-making
 */

import { Lead, Communication, Appointment, CallOutcome } from '@prisma/client';

export interface DealSignals {
  temperature: 'hot' | 'warm' | 'cooling' | 'cold' | 'dead';
  engagementTrend: 'improving' | 'stable' | 'declining';
  sentimentSignals: {
    lastReplyTone: 'enthusiastic' | 'neutral' | 'reluctant' | 'unknown';
    objectionDetected: boolean;
    questionCount: number;
  };
  contextualUrgency: string | null;
  leadSourceQuality: 'high' | 'medium' | 'low';
  motivationLevel: 'urgent' | 'active' | 'browsing' | 'unknown';
  reasoningContext: string;
  nextReviewHours: number; // Smart scheduling hint
}

type LeadWithRelations = Lead & {
  communications: Communication[];
  appointments?: Appointment[];
  callOutcomes?: CallOutcome[];
};

export function analyzeDealHealth(lead: LeadWithRelations): DealSignals {
  const now = Date.now();
  const lastContact = lead.lastContactedAt?.getTime() || lead.createdAt.getTime();
  const hoursSinceContact = (now - lastContact) / (1000 * 60 * 60);

  const inboundMessages = lead.communications.filter((c) => c.direction === 'INBOUND');
  const outboundMessages = lead.communications.filter((c) => c.direction === 'OUTBOUND');
  const repliedCount = inboundMessages.length;

  // === ENGAGEMENT TREND ===
  // Compare last 3 days vs previous 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;

  const recentReplies = inboundMessages.filter((m) => m.createdAt.getTime() > threeDaysAgo).length;
  const previousReplies = inboundMessages.filter(
    (m) => m.createdAt.getTime() > sixDaysAgo && m.createdAt.getTime() <= threeDaysAgo
  ).length;

  let engagementTrend: DealSignals['engagementTrend'];
  if (recentReplies > previousReplies) {
    engagementTrend = 'improving';
  } else if (recentReplies < previousReplies && previousReplies > 0) {
    engagementTrend = 'declining';
  } else {
    engagementTrend = 'stable';
  }

  // === SENTIMENT SIGNALS ===
  const lastReply = inboundMessages[0]?.content || '';
  const lastReplyTone = detectTone(lastReply);
  const objectionDetected = detectObjection(lastReply);
  const questionCount = (lastReply.match(/\?/g) || []).length;

  // === CONTEXTUAL URGENCY ===
  let contextualUrgency: string | null = null;
  const rawData = lead.rawData as any;

  if (rawData?.motivation_level === 'I have made an offer to purchase') {
    contextualUrgency = 'URGENT: Accepted offer - subject removal deadline likely soon';
  } else if (
    lead.status === 'CALL_COMPLETED' &&
    lead.callOutcomes?.[0]?.outcome === 'READY_FOR_APP'
  ) {
    contextualUrgency = 'HOT: Advisor marked ready for application after call';
  } else if (lead.applicationStartedAt && !lead.applicationCompletedAt) {
    const hoursStuck = (now - lead.applicationStartedAt.getTime()) / (1000 * 60 * 60);
    if (hoursStuck > 12) {
      contextualUrgency = `STUCK: Started application ${Math.floor(hoursStuck)}h ago, not completed`;
    }
  } else if (lead.appointments && lead.appointments.length > 0) {
    const nextAppt = lead.appointments[0];
    const apptTime = nextAppt.scheduledFor || nextAppt.scheduledAt;
    const hoursUntilAppt = (apptTime.getTime() - now) / (1000 * 60 * 60);

    if (hoursUntilAppt < 24 && hoursUntilAppt > 0) {
      contextualUrgency = `APPOINTMENT: Call in ${Math.floor(hoursUntilAppt)}h - ensure they show up`;
    }
  }

  // === LEAD SOURCE QUALITY ===
  const leadSourceQuality: DealSignals['leadSourceQuality'] =
    rawData?.ad_source === 'Google'
      ? 'medium'
      : rawData?.ad_source === 'Referral'
      ? 'high'
      : 'low';

  // === MOTIVATION LEVEL ===
  const motivationLevel: DealSignals['motivationLevel'] = rawData?.motivation_level?.includes(
    'offer to purchase'
  )
    ? 'urgent'
    : rawData?.motivation_level?.includes('soon')
    ? 'active'
    : rawData?.motivation_level?.includes('exploring') ||
      rawData?.motivation_level?.includes('qualified')
    ? 'browsing'
    : 'unknown';

  // === TEMPERATURE CALCULATION ===
  let temperature: DealSignals['temperature'];

  if (lead.status === 'CALL_SCHEDULED' || (lead.appointments && lead.appointments.length > 0)) {
    temperature = 'hot';
  } else if (repliedCount > 2 && hoursSinceContact < 12 && lastReplyTone === 'enthusiastic') {
    temperature = 'hot';
  } else if (repliedCount > 0 && hoursSinceContact < 48 && !objectionDetected) {
    temperature = 'warm';
  } else if (repliedCount > 0 && hoursSinceContact < 120) {
    temperature = 'cooling';
  } else if (repliedCount === 0 && hoursSinceContact > 96) {
    temperature = 'dead';
  } else if (repliedCount === 0 && hoursSinceContact > 48) {
    temperature = 'cold';
  } else {
    temperature = 'cooling';
  }

  // Override temperature based on urgency
  if (contextualUrgency?.startsWith('URGENT') || contextualUrgency?.startsWith('HOT')) {
    temperature = 'hot';
  } else if (contextualUrgency?.startsWith('STUCK')) {
    temperature = 'warm'; // Stuck but worth rescuing
  }

  // === NEXT REVIEW HOURS (Smart Scheduling) ===
  let nextReviewHours: number;
  switch (temperature) {
    case 'hot':
      nextReviewHours = 0.5; // 30 min
      break;
    case 'warm':
      nextReviewHours = 2; // 2 hours
      break;
    case 'cooling':
      nextReviewHours = 6; // 6 hours
      break;
    case 'cold':
      nextReviewHours = 24; // 1 day
      break;
    case 'dead':
      nextReviewHours = 168; // 1 week
      break;
  }

  // === REASONING CONTEXT ===
  const reasoningContext = [
    `Status: ${lead.status}`,
    `Last contact: ${Math.floor(hoursSinceContact)}h ago`,
    `Engagement: ${repliedCount} replies (trend: ${engagementTrend})`,
    `Sent: ${outboundMessages.length} messages`,
    lastReplyTone !== 'unknown' ? `Last reply tone: ${lastReplyTone}` : null,
    objectionDetected ? '⚠️ Objection detected in last message' : null,
    questionCount > 0 ? `Asked ${questionCount} question(s) - high engagement` : null,
    lead.appointments && lead.appointments.length > 0
      ? `Appointment: ${lead.appointments[0].scheduledAt}`
      : null,
    contextualUrgency || null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    temperature,
    engagementTrend,
    sentimentSignals: {
      lastReplyTone,
      objectionDetected,
      questionCount,
    },
    contextualUrgency,
    leadSourceQuality,
    motivationLevel,
    reasoningContext,
    nextReviewHours,
  };
}

// === HELPER FUNCTIONS ===

function detectTone(
  message: string
): 'enthusiastic' | 'neutral' | 'reluctant' | 'unknown' {
  if (!message) return 'unknown';

  const lower = message.toLowerCase();

  // Enthusiastic signals
  if (
    /(sounds good|great|perfect|awesome|yes|let's do it|interested|love|excited)/i.test(lower) ||
    /!/.test(message)
  ) {
    return 'enthusiastic';
  }

  // Reluctant signals
  if (
    /(maybe|not sure|not right now|let me think|not interested|busy|can't|won't)/i.test(lower)
  ) {
    return 'reluctant';
  }

  return 'neutral';
}

function detectObjection(message: string): boolean {
  if (!message) return false;

  const objectionPatterns = [
    /not interested/i,
    /already have/i,
    /working with someone/i,
    /too expensive/i,
    /can't afford/i,
    /not ready/i,
    /maybe later/i,
    /stop texting/i,
    /stop messaging/i,
    /remove me/i,
    /unsubscribe/i,
  ];

  return objectionPatterns.some((pattern) => pattern.test(message));
}
