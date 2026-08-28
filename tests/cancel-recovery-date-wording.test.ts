/**
 * Tests for cancel-recovery SMS date wording bug fix
 * 
 * Issue: Harper (test lead) had a 3:20 PM PT cancellation on Aug 27.
 * Same evening (Aug 27), Holly sent recovery SMS saying "yesterday" when it should say "earlier today".
 * 
 * Root cause: Holly's briefing didn't include timezone-aware relative date context for cancellations.
 * 
 * Fix: Added getRelativeDatePhrase utility and updated buildHollyBriefing to provide explicit
 * relative date context (e.g., "this afternoon", "earlier today", "yesterday") in lead's timezone.
 */

import { describe, it, expect } from 'vitest';
import { getRelativeDatePhrase } from '../lib/timezone-utils';

describe('Cancel Recovery Date Wording', () => {
  describe('getRelativeDatePhrase', () => {
    const vancouverTz = 'America/Vancouver';

    it('should return "this afternoon" for same-day afternoon cancellation', () => {
      // Aug 27, 2026, 3:20 PM PT (cancellation time)
      const cancelTime = new Date('2026-08-27T22:20:00.000Z'); // 3:20 PM PT = 22:20 UTC
      
      // Aug 27, 2026, 8:00 PM PT (recovery message time, same day)
      const recoveryTime = new Date('2026-08-28T03:00:00.000Z'); // 8:00 PM PT = 03:00 UTC next day

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('this afternoon');
    });

    it('should return "this morning" for same-day morning cancellation', () => {
      // Aug 27, 2026, 10:00 AM PT
      const cancelTime = new Date('2026-08-27T17:00:00.000Z'); // 10:00 AM PT = 17:00 UTC
      
      // Aug 27, 2026, 5:00 PM PT (same day)
      const recoveryTime = new Date('2026-08-28T00:00:00.000Z'); // 5:00 PM PT = 00:00 UTC next day

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('this morning');
    });

    it('should return "earlier today" for same-day evening cancellation', () => {
      // Aug 27, 2026, 6:00 PM PT
      const cancelTime = new Date('2026-08-28T01:00:00.000Z'); // 6:00 PM PT = 01:00 UTC next day
      
      // Aug 27, 2026, 11:00 PM PT (same calendar day in PT, but technically next UTC day)
      const recoveryTime = new Date('2026-08-28T06:00:00.000Z'); // 11:00 PM PT = 06:00 UTC

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('earlier today');
    });

    it('should return "yesterday" for previous calendar day in lead timezone', () => {
      // Aug 26, 2026, 3:00 PM PT
      const cancelTime = new Date('2026-08-26T22:00:00.000Z'); // 3:00 PM PT = 22:00 UTC
      
      // Aug 27, 2026, 10:00 AM PT (next calendar day in PT)
      const recoveryTime = new Date('2026-08-27T17:00:00.000Z'); // 10:00 AM PT = 17:00 UTC

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('yesterday');
    });

    it('should handle UTC midnight crossover correctly (same PT calendar day)', () => {
      // Aug 27, 2026, 11:30 PM PT (before midnight PT, after midnight UTC)
      const cancelTime = new Date('2026-08-28T06:30:00.000Z'); // 11:30 PM PT Aug 27 = 06:30 UTC Aug 28
      
      // Aug 28, 2026, 12:30 AM PT (just after midnight PT, but still Aug 28 UTC)
      const recoveryTime = new Date('2026-08-28T07:30:00.000Z'); // 12:30 AM PT Aug 28 = 07:30 UTC Aug 28

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      // These are different calendar days in PT (Aug 27 vs Aug 28), so it should be "yesterday"
      expect(result).toBe('yesterday');
    });

    it('should return "2 days ago" for 2-day-old cancellation', () => {
      const cancelTime = new Date('2026-08-25T20:00:00.000Z'); // Aug 25, 1:00 PM PT
      const recoveryTime = new Date('2026-08-27T20:00:00.000Z'); // Aug 27, 1:00 PM PT

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('2 days ago');
    });

    it('should return "3 days ago" for 3-day-old cancellation', () => {
      const cancelTime = new Date('2026-08-24T20:00:00.000Z'); // Aug 24, 1:00 PM PT
      const recoveryTime = new Date('2026-08-27T20:00:00.000Z'); // Aug 27, 1:00 PM PT

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      expect(result).toBe('3 days ago');
    });

    it('should handle Toronto timezone (ET)', () => {
      const torontoTz = 'America/Toronto';
      
      // Aug 27, 2026, 3:00 PM ET
      const cancelTime = new Date('2026-08-27T19:00:00.000Z'); // 3:00 PM ET = 19:00 UTC
      
      // Aug 27, 2026, 8:00 PM ET (same day)
      const recoveryTime = new Date('2026-08-28T00:00:00.000Z'); // 8:00 PM ET = 00:00 UTC next day

      const result = getRelativeDatePhrase(cancelTime, torontoTz, recoveryTime);
      
      expect(result).toBe('this afternoon');
    });
  });

  describe('Scenario: Harper test case (Aug 27 afternoon cancel, evening recovery)', () => {
    it('should correctly identify same-day cancellation in PT timezone', () => {
      const vancouverTz = 'America/Vancouver';
      
      // Harper's appointment was cancelled at 3:20 PM PT on Aug 27
      const cancelTime = new Date('2026-08-27T22:20:00.000Z'); // 3:20 PM PT = 22:20 UTC
      
      // Recovery SMS sent at 8:45 PM PT on Aug 27 (same calendar day in PT)
      const recoveryTime = new Date('2026-08-28T03:45:00.000Z'); // 8:45 PM PT = 03:45 UTC (next day)

      const result = getRelativeDatePhrase(cancelTime, vancouverTz, recoveryTime);
      
      // Should be "this afternoon", NOT "yesterday"
      expect(result).toBe('this afternoon');
      expect(result).not.toBe('yesterday');
    });
  });
});
