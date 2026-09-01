/**
 * Lead Segmentation Tests
 * 
 * Tests for multi-source lead ingest and segment derivation logic.
 */

import { deriveLeadSegment, formatPhoneE164 } from '../lib/lead-segmentation';

describe('Lead Segmentation', () => {
  describe('deriveLeadSegment', () => {
    it('FinanceVine leads default to alt_private', () => {
      const result = deriveLeadSegment({
        source: 'financevine',
        rawData: {
          mortgage_type: 'refinance',
          primary_goal: 'debt consolidation',
          borrower_profile: 'unsure',
        },
      });

      expect(result.segment).toBe('alt_private');
      expect(result.intent).toBe('equity'); // debt consolidation -> equity
      expect(result.bankability).toBe('unsure');
    });

    it('FinanceVine lead with "not approved" is alt_private', () => {
      const result = deriveLeadSegment({
        source: 'financevine',
        rawData: {
          borrower_profile: 'not approved at bank',
        },
      });

      expect(result.segment).toBe('alt_private');
      expect(result.bankability).toBe('not_approved');
    });

    it('rates.ca leads default to prime_rate_shop', () => {
      const result = deriveLeadSegment({
        source: 'rates_ca',
        rawData: {
          loan_type: 'refinance',
        },
      });

      expect(result.segment).toBe('prime_rate_shop');
      expect(result.intent).toBe('refinance');
      expect(result.bankability).toBe('unknown');
    });

    it('LOD leads with "not approved" become alt_private', () => {
      const result = deriveLeadSegment({
        source: 'leads_on_demand',
        rawData: {
          borrower_profile: 'not approved',
        },
      });

      expect(result.segment).toBe('alt_private');
      expect(result.bankability).toBe('not_approved');
    });

    it('LOD leads default to prime_other', () => {
      const result = deriveLeadSegment({
        source: 'leads_on_demand',
        rawData: {
          loanType: 'purchase',
        },
      });

      expect(result.segment).toBe('prime_other');
      expect(result.intent).toBe('purchase');
      expect(result.bankability).toBe('unknown');
    });
  });

  describe('Intent Derivation', () => {
    it('detects equity intent from primary_goal', () => {
      const result = deriveLeadSegment({
        source: 'financevine',
        rawData: {
          primary_goal: 'take out equity',
        },
      });

      expect(result.intent).toBe('equity');
    });

    it('detects refinance intent from loan type', () => {
      const result = deriveLeadSegment({
        source: 'leads_on_demand',
        rawData: {
          loanType: 'refinance',
        },
      });

      expect(result.intent).toBe('refinance');
    });

    it('detects purchase intent from motivation', () => {
      const result = deriveLeadSegment({
        source: 'leads_on_demand',
        rawData: {
          motivation_level: 'I have made an offer to purchase',
        },
      });

      expect(result.intent).toBe('purchase');
    });

    it('detects renewal intent from loan type', () => {
      const result = deriveLeadSegment({
        source: 'leads_on_demand',
        rawData: {
          loanType: 'renewal',
        },
      });

      expect(result.intent).toBe('renewal');
    });

    it('detects reverse mortgage from age_55_plus', () => {
      const result = deriveLeadSegment({
        source: 'financevine',
        rawData: {
          age_55_plus: true,
        },
      });

      expect(result.intent).toBe('reverse');
    });
  });

  describe('formatPhoneE164', () => {
    it('formats 10-digit phone to E.164', () => {
      expect(formatPhoneE164('6045551234')).toBe('+16045551234');
    });

    it('formats phone with formatting to E.164', () => {
      expect(formatPhoneE164('(604) 555-1234')).toBe('+16045551234');
    });

    it('handles 11-digit phone starting with 1', () => {
      expect(formatPhoneE164('16045551234')).toBe('+16045551234');
    });

    it('handles already formatted E.164', () => {
      expect(formatPhoneE164('+16045551234')).toBe('+16045551234');
    });
  });
});
