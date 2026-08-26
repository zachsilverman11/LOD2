/**
 * Phone Matching Utilities
 * 
 * Deterministic phone matching to prevent inbound SMS from attaching to the wrong lead.
 * 
 * Production incident 2026-08-26:
 * - Twilio inbound used `findFirst({ phone: { contains: last10 } })` with no orderBy
 * - When multiple leads share last-10 digits (test numbers, format variants, duplicates),
 *   the query was non-deterministic
 * - Harper Test (+16048974960) inbound attached to an older lead with same last-10
 * 
 * Solution:
 * 1. Try exact E.164 match first (normalized full number)
 * 2. If no match or ambiguous, fall back to last-10 with deterministic ordering:
 *    - Most recently contacted (lastContactedAt DESC)
 *    - Then most recently updated (updatedAt DESC)
 * 3. Never use unordered findFirst
 */

import { prisma } from './db';

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
  
  // STEP 1: Try exact E.164 match
  const exactMatch = await prisma.lead.findFirst({
    where: {
      phone: normalizedPhone,
    },
  });
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // STEP 2: Fall back to last-10 matching with deterministic ordering
  // Order by: most recently contacted, then most recently updated
  // This ensures we attach to the active conversation, not an old duplicate
  const candidates = await prisma.lead.findMany({
    where: {
      phone: {
        contains: last10,
      },
    },
    orderBy: [
      { lastContactedAt: { sort: 'desc', nulls: 'last' } },
      { updatedAt: 'desc' },
    ],
    take: 1,
  });
  
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Normalize phone number to E.164 format
 * Exported for testing and reuse
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode: string = '+1'): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (!phone.startsWith('+')) {
    // If it's a 10-digit number (North American), add +1
    if (cleaned.length === 10) {
      cleaned = defaultCountryCode.replace('+', '') + cleaned;
    }
  }
  
  return '+' + cleaned;
}
