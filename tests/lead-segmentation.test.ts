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

    // The consolidation stem is matched on "consolidat" so the noun, verb and
    // gerund all land on equity. Each of these pairs a consolidation goal with a
    // "refinance" loan type and contains NO "equity"/"cash", so they discriminate
    // the stem fix: on the old .includes('consolidate') they returned 'refinance'.
    const consolidationGoals = [
      'debt consolidation',
      'consolidate debt',
      'consolidating my debts',
      'Debt Consolidation',
    ];

    consolidationGoals.forEach((goal) => {
      it(`classifies "${goal}" as equity, not refinance`, () => {
        const result = deriveLeadSegment({
          source: 'financevine',
          rawData: { mortgage_type: 'refinance', primary_goal: goal },
        });

        expect(result.intent).toBe('equity');
      });
    });

    it('still classifies a genuine refinance as refinance', () => {
      const result = deriveLeadSegment({
        source: 'financevine',
        rawData: { mortgage_type: 'refinance', primary_goal: 'lower payment' },
      });

      expect(result.intent).toBe('refinance');
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

  describe('Bankability Derivation', () => {
    const bankability = (borrower_profile: string) =>
      deriveLeadSegment({ source: 'financevine', rawData: { borrower_profile } }).bankability;

    // The four phrasings probed against production during PR #26 verification,
    // plus FinanceVine's literal form value. Two of these were wrong before:
    // "Not able to get approved at the bank" returned 'unknown', and without
    // the "the" it returned 'bank_approved' — a declined borrower tagged
    // bankable, which routes them into the prime playbook.
    const declined = [
      'Not able to get approved at the bank',
      'Not able to get approved at bank',
      'not approved at bank',
      'Bank said no',
      "I'm not able to get approved at the bank",
    ];

    declined.forEach((profile) => {
      it(`treats "${profile}" as not_approved`, () => {
        expect(bankability(profile)).toBe('not_approved');
      });
    });

    // Each alias in the set, in a natural sentence.
    const aliasPhrasings = [
      'Unable to get approved at the bank',
      "Can't get approved at my bank",
      'Cannot get approved at the bank',
      'The bank declined me',
      'I was denied by the bank',
      'Bank turned down my application',
    ];

    aliasPhrasings.forEach((profile) => {
      it(`treats "${profile}" as not_approved`, () => {
        expect(bankability(profile)).toBe('not_approved');
      });
    });

    it('still recognises explicit approval', () => {
      expect(bankability('approved at bank')).toBe('bank_approved');
      expect(bankability('Approved at the bank')).toBe('bank_approved');
      expect(bankability('Pre-approved')).toBe('bank_approved');
    });

    it('does not read approval out of a declined phrasing', () => {
      // Contains "approved at the bank" as a substring, but is a decline.
      expect(bankability('Unable to get approved at the bank')).not.toBe('bank_approved');
    });

    it('preserves unsure', () => {
      expect(bankability('unsure')).toBe('unsure');
      expect(bankability('Unsure if I qualify')).toBe('unsure');
    });

    it('preserves unknown for an unrecognised profile', () => {
      expect(bankability('Self-employed, good credit')).toBe('unknown');
    });

    it('honours the structured fields', () => {
      const viaFlag = (rawData: any) =>
        deriveLeadSegment({ source: 'financevine', rawData }).bankability;

      expect(viaFlag({ bank_approved: true })).toBe('bank_approved');
      expect(viaFlag({ bank_approved: false })).toBe('not_approved');
      expect(viaFlag({ bank_status: 'approved' })).toBe('bank_approved');
      expect(viaFlag({ bank_status: 'not_approved' })).toBe('not_approved');
      expect(viaFlag({ bank_status: 'unsure' })).toBe('unsure');
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
