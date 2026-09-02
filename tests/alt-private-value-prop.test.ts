/**
 * Alt-Private Value Proposition Tests
 *
 * The decision prompt injects a value proposition for every lead. For
 * alt_private leads that text must not contain any phrase the alt_private
 * guardrail bans - otherwise the prompt is steering Holly toward a message
 * that will be blocked.
 *
 * These tests run the REAL validator over the REAL value-proposition text, so
 * the ban list cannot drift out of sync with a copy in this file.
 */

import Anthropic from '@anthropic-ai/sdk';

// The decision engine constructs an Anthropic client at module load.
jest.mock('@anthropic-ai/sdk');
(Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
  create: jest.fn(),
} as any;

import { getAltPrivateValueProposition } from '../lib/holly/decision-engine';
import { validateDecision, HollyDecision } from '../lib/holly/guardrails';
import { Lead } from '@/app/generated/prisma';
import { DealSignals } from '../lib/deal-intelligence';

describe('Alt-Private Value Proposition', () => {
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

  // Shape copied from tests/alt-private-guardrails.test.ts; only the fields the
  // validator reads matter here.
  const mockSignals = {
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
  } as unknown as DealSignals;

  const validateAsAltPrivate = (message: string) => {
    const decision: HollyDecision = {
      thinking: 'Value proposition injected into the decision prompt',
      action: 'send_sms',
      message,
      confidence: 'high',
    };

    return validateDecision(decision, {
      lead: createMockLead('alt_private') as any,
      signals: mockSignals,
    });
  };

  // Every payload shape the alt_private value proposition branches on.
  const payloads: Array<{ name: string; rawData: any }> = [
    { name: 'default (no urgency)', rawData: {} },
    {
      name: 'accepted offer to purchase',
      rawData: { motivation_level: 'I have made an offer to purchase' },
    },
  ];

  payloads.forEach(({ name, rawData }) => {
    it(`contains no alt_private banned phrase - ${name}`, () => {
      const validation = validateAsAltPrivate(getAltPrivateValueProposition(rawData));

      expect(
        validation.errors.filter((e) => e.includes('alt_private segment violation'))
      ).toEqual([]);
    });

    it(`contains no qualify-for / qualify-if invitation - ${name}`, () => {
      const valueProp = getAltPrivateValueProposition(rawData).toLowerCase();

      expect(valueProp).not.toMatch(/qualify/);
    });

    it(`quotes no rate percentage and promises no approval - ${name}`, () => {
      const validation = validateAsAltPrivate(getAltPrivateValueProposition(rawData));

      expect(
        validation.errors.filter(
          (e) =>
            e.includes('specific rate percentage') ||
            e.includes('ALT-LENDING GUARDRAIL #8') ||
            e.includes('approval-likelihood')
        )
      ).toEqual([]);
    });
  });
});
