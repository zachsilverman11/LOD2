/**
 * Phone Matching Integration Tests
 * 
 * Tests the deterministic phone matching logic to prevent inbound SMS
 * from attaching to the wrong lead (production incident 2026-08-26).
 */

import { findLeadByPhone, normalizePhoneNumber } from '../lib/phone-matching';
import { prisma } from '../lib/db';

// Mock the database
jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('Phone Matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePhoneNumber', () => {
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
    test('finds lead by exact E.164 match', async () => {
      const mockLead = {
        id: 'lead-123',
        phone: '+16048974960',
        firstName: 'Harper',
        lastName: 'Test',
      };

      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(mockLead);

      const result = await findLeadByPhone('+16048974960');

      expect(result).toEqual(mockLead);
      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: {
          phone: '+16048974960',
        },
      });
    });

    test('falls back to last-10 matching with deterministic ordering', async () => {
      const mockLeads = [
        {
          id: 'lead-newer',
          phone: '+16048974960',
          firstName: 'Harper',
          lastName: 'Test',
          lastContactedAt: new Date('2026-08-25'),
          updatedAt: new Date('2026-08-26'),
        },
      ];

      // First call (exact match) returns null
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      // Second call (last-10 fallback) returns candidates
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce(mockLeads);

      const result = await findLeadByPhone('(604) 897-4960');

      expect(result).toEqual(mockLeads[0]);
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {
          phone: {
            contains: '6048974960',
          },
        },
        orderBy: [
          { lastContactedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        take: 1,
      });
    });

    test('picks most recently contacted lead when multiple match last-10', async () => {
      const olderLead = {
        id: 'lead-old',
        phone: '604-897-4960', // Legacy format
        firstName: 'Holly',
        lastName: 'Old',
        lastContactedAt: new Date('2026-08-20'),
        updatedAt: new Date('2026-08-20'),
      };

      const newerLead = {
        id: 'lead-new',
        phone: '+16048974960',
        firstName: 'Harper',
        lastName: 'Test',
        lastContactedAt: new Date('2026-08-25'),
        updatedAt: new Date('2026-08-26'),
      };

      // Exact match fails
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      // Last-10 match returns ordered by lastContactedAt DESC
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([newerLead]);

      const result = await findLeadByPhone('+16048974960');

      expect(result?.id).toBe('lead-new');
    });

    test('picks most recently updated when lastContactedAt is null for both', async () => {
      const olderLead = {
        id: 'lead-old',
        phone: '604-897-4960',
        firstName: 'Old',
        lastName: 'Lead',
        lastContactedAt: null,
        updatedAt: new Date('2026-08-20'),
      };

      const newerLead = {
        id: 'lead-new',
        phone: '+16048974960',
        firstName: 'New',
        lastName: 'Lead',
        lastContactedAt: null,
        updatedAt: new Date('2026-08-26'),
      };

      // Exact match fails
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      // Last-10 match returns ordered by updatedAt DESC (since lastContactedAt is null)
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([newerLead]);

      const result = await findLeadByPhone('+16048974960');

      expect(result?.id).toBe('lead-new');
    });

    test('returns null when no leads match', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await findLeadByPhone('+16048974960');

      expect(result).toBeNull();
    });

    test('handles duplicate phones by picking most recently contacted', async () => {
      // Incident scenario: two leads with same last-10 digits
      const testLead1 = {
        id: 'cmgva9xdc0000hejhsbddnyvh', // The wrong lead that got the inbound
        phone: '+17788974960',
        firstName: 'Zach',
        lastName: 'Old',
        lastContactedAt: new Date('2026-08-20'),
        updatedAt: new Date('2026-08-20'),
      };

      const testLead2 = {
        id: 'cmtabaryi0001jq04m5xqvewh', // Harper Test - should get the inbound
        phone: '+16048974960',
        firstName: 'Harper',
        lastName: 'Test',
        lastContactedAt: new Date('2026-08-26'), // More recent
        updatedAt: new Date('2026-08-26'),
      };

      // Exact match fails (since we're searching for a slightly different format)
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      // Last-10 returns ordered list with most recently contacted first
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([testLead2]);

      const result = await findLeadByPhone('(604) 897-4960');

      // Should get Harper Test, not the older lead
      expect(result?.id).toBe('cmtabaryi0001jq04m5xqvewh');
      expect(result?.firstName).toBe('Harper');
    });
  });
});
