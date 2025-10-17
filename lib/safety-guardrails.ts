/**
 * Safety Guardrails
 * Hard boundary enforcement for Holly's autonomous decisions
 */

import { Lead } from '@prisma/client';
import { DealSignals } from './deal-intelligence';
import { getLocalTime } from './timezone-utils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HollyDecision {
  thinking: string;
  action: 'send_sms' | 'send_booking_link' | 'send_application_link' | 'wait' | 'escalate';
  message?: string;
  waitHours?: number;
  nextCheckCondition?: string;
  suggestedAction?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface DecisionContext {
  lead: Lead & {
    communications?: any[];
    appointments?: any[];
  };
  signals: DealSignals;
}

export function validateDecision(
  decision: HollyDecision,
  context: DecisionContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date();

  // === HARD RULE: Opt-out check ===
  if (!context.lead.consentSms) {
    errors.push('Lead opted out of SMS - cannot send messages');
  }

  // === HARD RULE: Time-of-day check (8am-9pm local) ===
  const rawData = context.lead.rawData as any;
  const province = rawData?.province || 'British Columbia';
  const leadLocalTime = getLocalTime(province);
  const hour = leadLocalTime.getHours();

  if (hour < 8 || hour >= 21) {
    if (decision.action !== 'wait' && decision.action !== 'escalate') {
      errors.push(
        `Outside SMS hours (${hour}:${leadLocalTime
          .getMinutes()
          .toString()
          .padStart(2, '0')} local time in ${province}) - can only send 8am-9pm`
      );
    }
  }

  // === HARD RULE: Anti-spam (4 hour minimum between messages) ===
  if (context.lead.lastContactedAt) {
    const hoursSinceLastOutbound =
      (now.getTime() - context.lead.lastContactedAt.getTime()) / (1000 * 60 * 60);

    if (
      hoursSinceLastOutbound < 4 &&
      decision.action !== 'wait' &&
      decision.action !== 'escalate'
    ) {
      errors.push(
        `Too soon - last message ${hoursSinceLastOutbound.toFixed(1)}h ago (minimum 4h gap required)`
      );
    }
  }

  // === HARD RULE: Don't double-book ===
  if (
    context.lead.appointments &&
    context.lead.appointments.length > 0 &&
    decision.action === 'send_booking_link'
  ) {
    errors.push('Lead already has an appointment scheduled - cannot double-book');
  }

  // === HARD RULE: Require message for send actions ===
  if (
    (decision.action === 'send_sms' ||
      decision.action === 'send_booking_link' ||
      decision.action === 'send_application_link') &&
    !decision.message
  ) {
    errors.push('Message required for send actions');
  }

  // === HARD RULE: Message must not be empty or whitespace only ===
  if (decision.message && decision.message.trim().length === 0) {
    errors.push('Message cannot be empty or whitespace only');
  }

  // === SOFT WARNING: Flag long messages (>320 chars = 2 SMS) ===
  if (decision.message && decision.message.length > 320) {
    warnings.push(
      `Long message (${decision.message.length} chars) - consider shortening for better SMS delivery`
    );
  }

  // === SOFT WARNING: Flag low confidence decisions ===
  if (decision.confidence === 'low' && decision.action !== 'escalate' && decision.action !== 'wait') {
    warnings.push(
      `Low confidence decision - consider escalating to human or waiting: "${decision.thinking}"`
    );
  }

  // === SOFT WARNING: Check for common repetitive phrases ===
  if (decision.message) {
    const repetitivePhrases = [
      'thanks for your text',
      'got your text',
      'thanks for reaching out',
      'hope this email finds you well',
    ];

    const message = decision.message.toLowerCase();
    const foundRepetitive = repetitivePhrases.filter((phrase) => message.includes(phrase));

    if (foundRepetitive.length > 0) {
      warnings.push(
        `Message contains potentially repetitive phrase(s): "${foundRepetitive.join('", "')}" - verify this is intentional`
      );
    }
  }

  // === SOFT WARNING: Detect if message might be too salesy ===
  if (decision.message) {
    const salesyPhrases = [
      'limited time',
      'act now',
      'don\'t miss out',
      'exclusive offer',
      'once in a lifetime',
    ];

    const message = decision.message.toLowerCase();
    const foundSalesy = salesyPhrases.filter((phrase) => message.includes(phrase));

    if (foundSalesy.length > 0) {
      warnings.push(
        `Message may be too salesy with phrase(s): "${foundSalesy.join('", "')}" - ensure this aligns with Holly's personality`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Additional validation: Check for repetition across recent conversation history
 */
export function detectMessageRepetition(
  newMessage: string,
  recentMessages: Array<{ role: string; content: string }>
): { isRepetitive: boolean; suggestion: string } {
  const recentOutbound = recentMessages.filter((m) => m.role === 'assistant').slice(0, 5);

  if (recentOutbound.length === 0) {
    return { isRepetitive: false, suggestion: '' };
  }

  const newLower = newMessage.toLowerCase();

  // Check for exact or near-exact matches
  for (const msg of recentOutbound) {
    const msgLower = msg.content.toLowerCase();

    // Exact match
    if (newLower === msgLower) {
      return {
        isRepetitive: true,
        suggestion: 'This exact message was already sent. Try a completely different approach.',
      };
    }

    // High similarity (Jaccard similarity of words)
    const similarity = calculateJaccardSimilarity(newLower, msgLower);
    if (similarity > 0.7) {
      return {
        isRepetitive: true,
        suggestion: `Message is ${Math.round(similarity * 100)}% similar to a recent message. Try a different angle.`,
      };
    }
  }

  // Check for repeated opening phrases
  const openings = recentOutbound.map((m) => m.content.split('\n')[0].toLowerCase().slice(0, 50));
  const newOpening = newLower.split('\n')[0].slice(0, 50);

  const repeatedOpening = openings.filter((opening) => opening === newOpening);
  if (repeatedOpening.length > 1) {
    return {
      isRepetitive: true,
      suggestion: `Opening phrase "${newOpening}..." has been used ${repeatedOpening.length + 1} times. Vary your opening.`,
    };
  }

  return { isRepetitive: false, suggestion: '' };
}

// Helper: Calculate Jaccard similarity between two strings
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
