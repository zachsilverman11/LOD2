/**
 * Alt-Private Guardrails Tests
 * 
 * Tests for alt_private segment-specific guardrails that ban
 * bankable program language.
 */

import { validateDecision, HollyDecision } from '../lib/holly/guardrails';
import { Lead } from '@/app/generated/prisma';
import { DealSignals } from '../lib/deal-intelligence';

describe('Alt-Private Guardrails', () => {
  // Helper to create a mock lead
  const createMockLead = (segment: string): Partial<Lead> => ({
    id: 'test-lead-id',
    email: 'test@example.com',
    phone: '+16045551234',
    firstName: 'Test',
    lastName: 'Lead',
    status: 'NEW',
    source: 'financevine',
    segment,
    consentSms: true,
    consentEmail: true,
    consentCall: true,
    hollyDisabled: false,
    managedByAutonomous: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    rawData: { segment },
  });

  const mockSignals: DealSignals = {
    daysSinceCreated: 0,
    hoursSinceLastContact: null,
    hasReplied: false,
    hasBooked: false,
    hasApplicationStarted: false,
    hasApplicationCompleted: false,
    hasCallOutcome: false,
    lastCallOutcome: null,
    lastReply: null,
    contactCount: 0,
    urgency: 'medium',
    sentiment: 'neutral',
  };

  describe('Banned Phrases for alt_private', () => {
    const bannedPhrases = [
      'We have low rates available',
      'Check out our ultra-low rates',
      'Reserved rates just for you',
      'No penalties program',
      'Guaranteed approval for your mortgage',
      'Cash back available',
      'We have the best rate',
      'What rate is your bank at?',
      'Let me pull your credit',
      'See if you qualify',
    ];

    bannedPhrases.forEach((phrase) => {
      it(`blocks "${phrase}" for alt_private segment`, () => {
        const decision: HollyDecision = {
          thinking: 'Testing alt_private guardrails',
          action: 'send_sms',
          message: phrase,
          confidence: 'high',
        };

        const validation = validateDecision(decision, {
          lead: createMockLead('alt_private') as any,
          signals: mockSignals,
        });

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some((e) => e.includes('alt_private segment violation'))).toBe(true);
      });
    });

    it('allows alt_private-friendly language', () => {
      const decision: HollyDecision = {
        thinking: 'Using alt_private playbook',
        action: 'send_sms',
        message:
          'Banks can be tricky with income situations. We work these files all the time. Quick call so the team can understand what\'s going on and see if there\'s a path. Sound good?',
        confidence: 'high',
      };

      const validation = validateDecision(decision, {
        lead: createMockLead('alt_private') as any,
        signals: mockSignals,
      });

      // Should not have alt_private violations (may have other errors like time-of-day)
      expect(
        validation.errors.some((e) => e.includes('alt_private segment violation'))
      ).toBe(false);
    });
  });

  describe('Prime Segments Not Affected', () => {
    const primeSegments = ['prime_rate_shop', 'prime_other'];

    primeSegments.forEach((segment) => {
      it(`allows bankable program language for ${segment}`, () => {
        const decision: HollyDecision = {
          thinking: 'Using prime playbook',
          action: 'send_sms',
          message: 'We have reserved ultra-low rates available. No penalties program included.',
          confidence: 'high',
        };

        const validation = validateDecision(decision, {
          lead: createMockLead(segment) as any,
          signals: mockSignals,
        });

        // Should not have alt_private violations (may have other errors like time-of-day)
        expect(
          validation.errors.some((e) => e.includes('alt_private segment violation'))
        ).toBe(false);
      });
    });
  });
});
