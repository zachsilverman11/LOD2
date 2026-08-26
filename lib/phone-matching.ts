/**
 * Phone Matching Utilities
 * 
 * Deterministic phone matching to prevent inbound SMS from attaching to the wrong lead.
 * 
 * Production incident 2026-08-26:
 * - Twilio inbound used `findFirst({ phone: { contains: last10 } })` with no orderBy
 * - When multiple leads share last-10 digits (test numbers, format variants, duplicates),
 *   the query was non-deterministic
 * - Harper Test inbound attached to an older lead with same last-10
 * 
 * Solution:
 * Single query with OR(exact E.164, last-10 contains) + deterministic ordering:
 * - Most recently contacted (lastContactedAt DESC NULLS LAST)
 * - Then most recently updated (updatedAt DESC)
 * - Never use unordered findFirst (Lead.phone is NOT unique in schema)
 */

import { prisma } from './db';
import { normalizePhoneNumber } from './sms';

/**
 * Find a lead by phone number with deterministic matching
 * 
 * @param phoneNumber - The phone number to search for (any format)
 * @returns The best matching lead, or null if no match found
 */
export async function findLeadByPhone(phoneNumber: string): Promise<any | null> {
  // Normalize to E.164 format
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Extract last 10 digits for fallback matching
  const last10 = normalizedPhone.replace(/\D/g, '').slice(-10);
  
  // Single query with OR(exact, last-10) + deterministic ordering
  // This handles both exact E.164 duplicates AND last-10 collisions
  // Order by: most recently contacted, then most recently updated
  // This ensures we attach to the active conversation, not an old duplicate
  const candidates = await prisma.lead.findMany({
    where: {
      OR: [
        { phone: normalizedPhone },
        { phone: { contains: last10 } },
      ],
    },
    orderBy: [
      { lastContactedAt: { sort: 'desc', nulls: 'last' } },
      { updatedAt: 'desc' },
    ],
    take: 1,
  });
  
  return candidates.length > 0 ? candidates[0] : null;
}
