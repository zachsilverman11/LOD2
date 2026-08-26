/**
 * Phone Matching Integration Tests
 * 
 * Tests the deterministic phone matching logic to prevent inbound SMS
 * from attaching to the wrong lead (production incident 2026-08-26).
 */

import { findLeadByPhone } from '../lib/phone-matching';
import { normalizePhoneNumber } from '../lib/sms';
import { prisma } from '../lib/db';

// Mock the database
jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
    },
  },
}));

describe('Phone Matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePhoneNumber (from lib/sms)', () => {
    test('normalizes 10-digit North American number', () => {
      expect(normalizePhoneNumber('6048974960')).toBe('+16048974960');
      expect(normalizePhoneNumber('(604) 897-4960')).toBe('+16048974960');
      expect(normalizePhoneNumber('604-897-4960')).toBe('+16048974960');
    });

    test('normalizes 11-digit number with country code', () => {
      expect(normalizePhoneNumber('16048974960')).toBe('+16048974960');
      expect(normalizePhoneNumber('1-604-897-4960')).toBe('+16048974960');
    });

    test('preserves E.164 format', () => {
      expect(normalizePhoneNumber('+16048974960')).toBe('+16048974960');
    });

    test('handles mixed formats', () => {
      expect(normalizePhoneNumber('+1 (604) 897-4960')).toBe('+16048974960');
      expect(normalizePhoneNumber('+1 604 897 4960')).toBe('+16048974960');
    });
  });

  describe('findLeadByPhone', () => {
    test('uses OR query with deterministic ordering for exact E.164 match', async () => {
      const mockLead = {
        id: 'test-lead-123',
        phone: '+16048974960',
        firstName: 'Test',
        lastName: 'User',
        lastContactedAt: new Date('2026-08-25'),
        updatedAt: new Date('2026-08-26'),
      };

      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([mockLead]);

      const result = await findLeadByPhone('+16048974960');

      expect(result).toEqual(mockLead);
      
      // Verify the Prisma call includes OR and orderBy
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { phone: '+16048974960' },
            { phone: { contains: '6048974960' } },
          ],
        },
        orderBy: [
          { lastContactedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        take: 1,
      });
    });

    test('handles exact E.164 duplicates with deterministic ordering', async () => {
      // Two leads with SAME exact E.164 phone (Lead.phone is NOT unique)
      const olderLead = {
        id: 'test-old-abc',
        phone: '+16045551234',
        firstName: 'Old',
        lastName: 'Lead',
        lastContactedAt: new Date('2026-08-20'),
        updatedAt: new Date('2026-08-20'),
      };

      const newerLead = {
        id: 'test-new-xyz',
        phone: '+16045551234', // SAME phone
        firstName: 'Active',
        lastName: 'Lead',
        lastContactedAt: new Date('2026-08-25'),
        updatedAt: new Date('2026-08-26'),
      };

      // Mock returns ordered by lastContactedAt DESC - newer lead first
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([newerLead]);

      const result = await findLeadByPhone('+16045551234');

      // Should get the more recently contacted lead
      expect(result?.id).toBe('test-new-xyz');
      
      // Verify orderBy was applied
      const call = (prisma.lead.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { lastContactedAt: { sort: 'desc', nulls: 'last' } },
        { updatedAt: 'desc' },
      ]);
    });

    test('handles last-10 collision with different full numbers', async () => {
      // Two leads with DIFFERENT area codes but SAME last 10 digits
      const olderLead = {
        id: 'test-old-778',
        phone: '+17785551234', // 778 area code
        firstName: 'Old',
        lastName: 'Lead',
        lastContactedAt: new Date('2026-08-20'),
        updatedAt: new Date('2026-08-20'),
      };

      const newerLead = {
        id: 'test-new-604',
        phone: '+16045551234', // 604 area code, same last 10
        firstName: 'Active',
        lastName: 'Lead',
        lastContactedAt: new Date('2026-08-25'),
        updatedAt: new Date('2026-08-26'),
      };

      // Mock returns ordered by lastContactedAt DESC
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([newerLead]);

      const result = await findLeadByPhone('604-555-1234');

      // Should get the more recently contacted lead
      expect(result?.id).toBe('test-new-604');
    });

    test('handles same last-10 with legacy format vs E.164', async () => {
      // Legacy format vs E.164 - same last 10 digits
      const legacyLead = {
        id: 'test-legacy-format',
        phone: '(604) 555-1234', // Legacy format
        firstName: 'Legacy',
        lastName: 'Format',
        lastContactedAt: new Date('2026-08-20'),
        updatedAt: new Date('2026-08-20'),
      };

      const e164Lead = {
        id: 'test-e164-format',
        phone: '+16045551234', // E.164 format
        firstName: 'E164',
        lastName: 'Format',
        lastContactedAt: new Date('2026-08-25'),
        updatedAt: new Date('2026-08-26'),
      };

      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([e164Lead]);

      const result = await findLeadByPhone('+16045551234');

      expect(result?.id).toBe('test-e164-format');
      
      // Verify the contains query would match both formats
      const call = (prisma.lead.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.OR[1]).toEqual({ phone: { contains: '6045551234' } });
    });

    test('picks most recently updated when lastContactedAt is null for both', async () => {
      const olderLead = {
        id: 'test-old-null',
        phone: '+16045551234',
        firstName: 'Old',
        lastName: 'Lead',
        lastContactedAt: null,
        updatedAt: new Date('2026-08-20'),
      };

      const newerLead = {
        id: 'test-new-null',
        phone: '+16045551234',
        firstName: 'New',
        lastName: 'Lead',
        lastContactedAt: null,
        updatedAt: new Date('2026-08-26'),
      };

      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([newerLead]);

      const result = await findLeadByPhone('+16045551234');

      expect(result?.id).toBe('test-new-null');
    });

    test('returns null when no leads match', async () => {
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await findLeadByPhone('+16045551234');

      expect(result).toBeNull();
    });
  });
});
