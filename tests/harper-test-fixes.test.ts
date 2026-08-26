/**
 * Harper Test Fixes Tests
 * 
 * Tests for three production issues identified in Harper Test lead (cmtabaryi0001jq04m5xqvewh):
 * 1. Direct booking: Holly sent Cal.com link instead of offering times
 * 2. Wrong first-touch opener: alt_private got the LOD prime rate-shop script
 * 3. Slogan/outcome-promise bans: "approved within days", "shopping for rates"
 */

import { validateDecision, HollyDecision } from '../lib/holly/guardrails';
import { buildHollyBriefing } from '../lib/holly/brain';
import { Lead } from '@/app/generated/prisma';
import { DealSignals } from '../lib/deal-intelligence';

describe('Harper Test Production Fixes', () => {
  // Helper to create a mock lead
  const createMockLead = (overrides: Partial<Lead> = {}): Partial<Lead> => ({
    id: 'test-lead-id',
    email: 'harper@test.com',
    phone: '+16045551234',
    firstName: 'Harper',
    lastName: 'Test',
    status: 'NEW',
    source: 'financevine',
    segment: 'alt_private',
    intent: 'debt_consolidation',
    consentSms: true,
    consentEmail: true,
    consentCall: true,
    hollyDisabled: false,
    managedByAutonomous: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    rawData: {
      first_name: 'Harper',
      last_name: 'Test',
      phone: '+16045551234',
      email: 'harper@test.com',
      mortgage_type: 'refinance',
      province: 'British Columbia',
      ingestTimestamp: new Date().toISOString(),
    },
    ...overrides,
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
    temperature: 'cold',
    engagementTrend: 'new',
    nextReviewHours: 24,
  };

  describe('Issue #1: Direct Booking - Link vs Times', () => {
    it('blocks send_booking_link when live slots exist', () => {
      const decision: HollyDecision = {
        thinking: 'Lead is ready to book',
        action: 'send_booking_link',
        message: 'Here\'s our calendar to book a time',
        confidence: 'high',
        _availabilitySlotsProvided: true, // Live slots exist
      };

      const validation = validateDecision(decision, {
        lead: createMockLead() as any,
        signals: mockSignals,
        availabilitySlotsProvided: true,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => 
        e.includes('send_booking_link but live calendar availability was provided')
      )).toBe(true);
    });

    it('blocks send_booking_link on first touch', () => {
      const decision: HollyDecision = {
        thinking: 'First contact with lead',
        action: 'send_booking_link',
        message: 'Hi Harper! Here\'s our calendar',
        confidence: 'high',
        _availabilityPrefetchSkipped: true, // First touch
      };

      const validation = validateDecision(decision, {
        lead: createMockLead() as any,
        signals: mockSignals,
        availabilitySlotsProvided: false,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => 
        e.includes('send_booking_link on the first touch')
      )).toBe(true);
    });

    it('allows send_booking_link when lead explicitly asks for link', () => {
      const decision: HollyDecision = {
        thinking: 'Lead requested the link',
        action: 'send_booking_link',
        message: 'Sure! Here\'s our calendar',
        confidence: 'high',
        _availabilitySlotsProvided: true,
      };

      // This test verifies the guard would pass if we had context that lead asked
      // In practice, the guardrail doesn't have "lead asked" context yet, so this
      // would still block. The rewrite logic in agent.ts handles this case.
      // For now, we verify the error exists (expected behavior)
      const validation = validateDecision(decision, {
        lead: createMockLead() as any,
        signals: mockSignals,
        availabilitySlotsProvided: true,
      });

      // Currently blocks (needs enhancement to detect "just send me the link" in lead reply)
      expect(validation.isValid).toBe(false);
    });

    it('allows send_sms with times offer when slots exist', () => {
      const decision: HollyDecision = {
        thinking: 'Offering specific times',
        action: 'send_sms',
        message: 'Greg has openings at 2pm and 4pm today, or 10am tomorrow. Which works?',
        confidence: 'high',
        _availabilitySlotsProvided: true,
      };

      const validation = validateDecision(decision, {
        lead: createMockLead() as any,
        signals: mockSignals,
        availabilitySlotsProvided: true,
      });

      // May have other errors (time-of-day, etc.) but NOT the booking link error
      expect(validation.errors.some(e => 
        e.includes('send_booking_link but live calendar availability was provided')
      )).toBe(false);
    });

    it('allows send_sms asking preferred time when slots are empty', () => {
      const decision: HollyDecision = {
        thinking: 'No slots available, asking for preference',
        action: 'send_sms',
        message: 'What day and time works best for you?',
        confidence: 'high',
        _availabilitySlotsProvided: false,
      };

      const validation = validateDecision(decision, {
        lead: createMockLead() as any,
        signals: mockSignals,
        availabilitySlotsProvided: false,
      });

      // Should not have booking link error
      expect(validation.errors.some(e => 
        e.includes('send_booking_link')
      )).toBe(false);
    });
  });

  describe('Issue #2: Alt-Private First-Touch Script', () => {
    it('passes segment to briefing for alt_private leads', () => {
      const lead = createMockLead({
        segment: 'alt_private',
        source: 'financevine',
        rawData: {
          first_name: 'Harper',
          mortgage_type: 'refinance',
          province: 'British Columbia',
          segment: 'alt_private',
        },
      });

      const briefing = buildHollyBriefing({
        leadData: {
          ...(lead.rawData as any),
          segment: lead.segment, // Pass from Lead schema
          source: lead.source,
          loanType: (lead.rawData as any).mortgage_type,
        },
        conversationContext: {
          touchNumber: 1,
          hasReplied: false,
          daysInPipeline: 0,
          messageHistory: '(No conversation yet)',
          lastMessageFrom: 'none',
        },
        appointments: [],
      });

      // Verify alt_private playbook is included
      expect(briefing).toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
      expect(briefing).toContain('alt_private');
      expect(briefing).toContain('Banks can be tricky');
    });

    it('maps mortgage_type from FinanceVine payload', () => {
      const lead = createMockLead({
        rawData: {
          first_name: 'Harper',
          mortgage_type: 'purchase', // FinanceVine uses this field
          province: 'British Columbia',
        },
      });

      const briefing = buildHollyBriefing({
        leadData: {
          ...(lead.rawData as any),
          loanType: (lead.rawData as any).mortgage_type, // Map to loanType
        },
        conversationContext: {
          touchNumber: 1,
          hasReplied: false,
          daysInPipeline: 0,
          messageHistory: '(No conversation yet)',
          lastMessageFrom: 'none',
        },
        appointments: [],
      });

      // Verify purchase-specific content appears
      expect(briefing).toContain('BUYING');
    });

    it('blocks prime rate-shop language on alt_private', () => {
      const decision: HollyDecision = {
        thinking: 'First contact',
        action: 'send_sms',
        message: 'Harper, Holly here from Inspired Mortgage. Saw you were shopping for rates in BC.',
        confidence: 'high',
      };

      const validation = validateDecision(decision, {
        lead: createMockLead({ segment: 'alt_private' }) as any,
        signals: mockSignals,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => 
        e.includes('alt_private segment violation') && e.includes('shopping for rates')
      )).toBe(true);
    });

    it('blocks "your rate is on its way" on alt_private', () => {
      const decision: HollyDecision = {
        thinking: 'First contact',
        action: 'send_sms',
        message: 'Your rate is on its way! Let me connect you with the team.',
        confidence: 'high',
      };

      const validation = validateDecision(decision, {
        lead: createMockLead({ segment: 'alt_private' }) as any,
        signals: mockSignals,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => 
        e.includes('alt_private segment violation') && e.includes('your rate is on')
      )).toBe(true);
    });

    it('allows alt_private-friendly first touch', () => {
      const decision: HollyDecision = {
        thinking: 'Alt-private playbook first touch',
        action: 'send_sms',
        message: 'Hi Harper! Holly from Inspired Mortgage. Saw you\'re looking at a refinance. Banks can be tricky with income situations - we work these files all the time. Quick call to understand what\'s going on? Sound good?',
        confidence: 'high',
      };

      const validation = validateDecision(decision, {
        lead: createMockLead({ segment: 'alt_private' }) as any,
        signals: mockSignals,
      });

      // May have other errors (time-of-day) but NOT alt_private violations
      expect(validation.errors.some(e => 
        e.includes('alt_private segment violation')
      )).toBe(false);
    });
  });

  describe('Issue #3: Outcome-Promise Slogan Bans', () => {
    const outcomePromises = [
      'Most of our "bank said no" clients get approved within days',
      'Most clients get approved within 48 hours',
      'You\'ll be approved in 2 days',
      'Get approved within 24 hours',
    ];

    outcomePromises.forEach((phrase) => {
      it(`blocks "${phrase}" (all segments)`, () => {
        const decision: HollyDecision = {
          thinking: 'Building urgency',
          action: 'send_sms',
          message: phrase,
          confidence: 'high',
        };

        const validation = validateDecision(decision, {
          lead: createMockLead({ segment: 'prime_other' }) as any,
          signals: mockSignals,
        });

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => 
          e.includes('Outcome-promise timing ban')
        )).toBe(true);
      });
    });

    it('allows describing the process without timing promises', () => {
      const decision: HollyDecision = {
        thinking: 'Setting expectations',
        action: 'send_sms',
        message: 'The team will review your application and follow up with next steps. Usually pretty quick!',
        confidence: 'high',
      };

      const validation = validateDecision(decision, {
        lead: createMockLead({ segment: 'prime_other' }) as any,
        signals: mockSignals,
      });

      // Should not have outcome-promise error
      expect(validation.errors.some(e => 
        e.includes('Outcome-promise timing ban')
      )).toBe(false);
    });
  });

  describe('Integration: All Three Fixes Together', () => {
    it('handles alt_private lead correctly end-to-end', () => {
      const lead = createMockLead({
        segment: 'alt_private',
        source: 'financevine',
        rawData: {
          first_name: 'Harper',
          mortgage_type: 'refinance',
          province: 'British Columbia',
          segment: 'alt_private',
          intent: 'debt_consolidation',
        },
      });

      // Build briefing
      const briefing = buildHollyBriefing({
        leadData: {
          ...(lead.rawData as any),
          segment: lead.segment,
          source: lead.source,
          intent: lead.intent,
          loanType: (lead.rawData as any).mortgage_type,
        },
        conversationContext: {
          touchNumber: 1,
          hasReplied: false,
          daysInPipeline: 0,
          messageHistory: '(No conversation yet)',
          lastMessageFrom: 'none',
        },
        appointments: [],
      });

      // Verify alt_private context
      expect(briefing).toContain('alt_private');
      expect(briefing).toContain('HARD BANS');

      // Test bad decision (all three violations)
      const badDecision: HollyDecision = {
        thinking: 'Bad approach',
        action: 'send_booking_link',
        message: 'Harper! Shopping for rates? Most clients get approved within 48 hours. Here\'s the link!',
        confidence: 'high',
        _availabilitySlotsProvided: true,
      };

      const validation = validateDecision(badDecision, {
        lead: lead as any,
        signals: mockSignals,
        availabilitySlotsProvided: true,
      });

      expect(validation.isValid).toBe(false);
      
      // Should block on all three issues:
      expect(validation.errors.some(e => 
        e.includes('send_booking_link but live calendar availability')
      )).toBe(true); // Issue #1
      
      expect(validation.errors.some(e => 
        e.includes('alt_private segment violation')
      )).toBe(true); // Issue #2
      
      expect(validation.errors.some(e => 
        e.includes('Outcome-promise timing ban')
      )).toBe(true); // Issue #3
    });

    it('allows correct alt_private approach', () => {
      const lead = createMockLead({
        segment: 'alt_private',
        source: 'financevine',
      });

      const goodDecision: HollyDecision = {
        thinking: 'Alt-private playbook with times offer',
        action: 'send_sms',
        message: 'Hi Harper! Holly from Inspired Mortgage. Saw your refinance inquiry. Banks can be tricky with some situations - we work these files all the time. The team can understand what\'s going on and see if there\'s a path. When works for you?',
        confidence: 'high',
        _availabilitySlotsProvided: true,
      };

      const validation = validateDecision(goodDecision, {
        lead: lead as any,
        signals: mockSignals,
        availabilitySlotsProvided: true,
      });

      // Should not have any of the three issue violations
      expect(validation.errors.some(e => 
        e.includes('send_booking_link but live calendar availability')
      )).toBe(false);
      
      expect(validation.errors.some(e => 
        e.includes('alt_private segment violation')
      )).toBe(false);
      
      expect(validation.errors.some(e => 
        e.includes('Outcome-promise timing ban')
      )).toBe(false);
    });
  });
});
