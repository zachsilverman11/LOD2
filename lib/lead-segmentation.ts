/**
 * Lead Segmentation Logic
 * 
 * Derives segment, intent, and bankability from lead data and source.
 * Used by all webhook ingest paths to consistently classify leads.
 */

export type LeadSegment = 'alt_private' | 'prime_rate_shop' | 'prime_other';
export type LeadIntent = 'equity' | 'refinance' | 'renewal' | 'purchase' | 'reverse' | 'rate_shop' | 'unknown';
export type LeadBankability = 'bank_approved' | 'not_approved' | 'unsure' | 'unknown';

export interface SegmentationResult {
  segment: LeadSegment;
  intent: LeadIntent;
  bankability: LeadBankability;
}

/**
 * Derive lead segment based on source and payload data
 */
export function deriveLeadSegment(params: {
  source: string;
  rawData: any;
}): SegmentationResult {
  const { source, rawData } = params;

  // FinanceVine leads default to alt_private
  if (source === 'financevine') {
    const bankability = deriveBankability(rawData);
    const intent = deriveIntent(rawData);
    
    // If explicitly marked as not approved or unsure, definitely alt_private
    const segment: LeadSegment = 
      bankability === 'not_approved' || bankability === 'unsure' 
        ? 'alt_private' 
        : 'alt_private'; // Default for FinanceVine (safer assumption)

    return { segment, intent, bankability };
  }

  // rates.ca leads default to prime_rate_shop
  if (source === 'rates_ca') {
    return {
      segment: 'prime_rate_shop',
      intent: deriveIntent(rawData),
      bankability: 'unknown',
    };
  }

  // LOD leads: try to infer, default to prime_other
  if (source === 'leads_on_demand') {
    const bankability = deriveBankability(rawData);
    const intent = deriveIntent(rawData);
    
    // If they explicitly said not approved/unsure, mark as alt_private
    const segment: LeadSegment = 
      bankability === 'not_approved' || bankability === 'unsure'
        ? 'alt_private'
        : 'prime_other';

    return { segment, intent, bankability };
  }

  // Unknown source: default to prime_other
  return {
    segment: 'prime_other',
    intent: deriveIntent(rawData),
    bankability: 'unknown',
  };
}

/**
 * Product strings that mean "reverse mortgage" without saying "reverse".
 * Lowercased input expected.
 */
const REVERSE_MORTGAGE_ALIASES =
  /reverse|home\s*equity\s*conversion|\bhecm\b|equity\s*release|\bchip\b|retirement\s*income\s*mortgage|senior[s]?\s*(equity|lending)|\b55\s*\+?\s*equity/;

/**
 * Goal strings that mean "take equity out of the home".
 * Lowercased input expected. "consolidat" is a stem on purpose: it covers
 * "consolidate debt", "debt consolidation" and "consolidating debts".
 */
const EQUITY_TAKEOUT_ALIASES = /equity|cash|consolidat/;

/**
 * Is the "55+" reverse-mortgage age flag set?
 *
 * FinanceVine's form only asks this on reverse-mortgage inquiries, so a "Yes"
 * is a reverse signal in its own right — it must catch a reverse lead even
 * when the product string is one we have never seen. Their key is the literal
 * "55"; the older ingest shape sends the boolean `age_55_plus` and Zapier has
 * been seen sending "55+". All three are read here, as booleans or as the
 * vendor's "Yes"/"No"/"N/A" strings.
 */
function isAge55Flag(rawData: any): boolean {
  const candidates = [rawData?.age_55_plus, rawData?.['55'], rawData?.['55+']];

  for (const candidate of candidates) {
    if (candidate === true) return true;
    if (typeof candidate === 'string') {
      const value = candidate.trim().toLowerCase();
      if (value === 'yes' || value === 'y' || value === 'true') return true;
    }
  }

  return false;
}

/**
 * Derive intent from form data
 */
function deriveIntent(rawData: any): LeadIntent {
  const loanType = (rawData?.loanType || rawData?.loan_type || rawData?.mortgage_type || '').toLowerCase();
  const primaryGoal = (rawData?.primary_goal || rawData?.goal || '').toLowerCase();
  const motivation = (rawData?.motivation_level || '').toLowerCase();

  // Check for reverse mortgage (55+) FIRST. Vendor product names for this
  // ("Home Equity Conversion Mortgage", "Equity Release", "55+ Equity Access")
  // contain "equity" and not "reverse", so the equity branch below used to
  // catch them. A reverse lead must never inherit the equity/declined playbook.
  if (
    REVERSE_MORTGAGE_ALIASES.test(loanType) ||
    REVERSE_MORTGAGE_ALIASES.test(primaryGoal) ||
    isAge55Flag(rawData)
  ) {
    return 'reverse';
  }

  // Check for equity take-out BEFORE refinance. A stated goal is more specific
  // than a product/loan type: debt-consolidation leads almost always arrive as
  // mortgage_type "refinance" with primary_goal "consolidate debt", and the
  // refinance branch below would otherwise swallow them. Same ordering fix as
  // the reverse branch above — most specific signal wins.
  // Matched on the "consolidat" stem so "consolidate", "consolidation" and
  // "consolidating" all land here; ".includes('consolidate')" missed the noun.
  if (
    EQUITY_TAKEOUT_ALIASES.test(primaryGoal) ||
    (rawData?.withdraw_amount && parseInt(rawData.withdraw_amount) > 0)
  ) {
    return 'equity';
  }

  // Check for refinance
  if (
    loanType.includes('refinance') ||
    primaryGoal.includes('refinance') ||
    primaryGoal.includes('lower payment')
  ) {
    return 'refinance';
  }

  // Check for renewal
  if (
    loanType.includes('renewal') ||
    primaryGoal.includes('renewal') ||
    primaryGoal.includes('renew')
  ) {
    return 'renewal';
  }

  // Check for purchase
  if (
    loanType.includes('purchase') ||
    motivation.includes('offer to purchase') ||
    primaryGoal.includes('buy') ||
    primaryGoal.includes('purchase')
  ) {
    return 'purchase';
  }

  // Check for rate shopping
  if (
    primaryGoal.includes('rate') ||
    primaryGoal.includes('compare') ||
    primaryGoal.includes('shop')
  ) {
    return 'rate_shop';
  }

  return 'unknown';
}

/**
 * Phrasings that mean "the bank turned me down".
 * Lowercased input expected.
 *
 * Substring matching is not enough here: FinanceVine's own form value is
 * "I'm not able to get approved at the bank", which contains neither the
 * literal "not approved" nor "bank said no", but DOES contain "approved at
 * the bank". Matching the positive first — or matching only the two literals
 * — tags a declined borrower as bankable and routes them to the prime
 * playbook, the exact opposite of the truth.
 */
const NOT_BANKABLE_ALIASES =
  /not\s+able\s+to\s+(?:get\s+)?approved|\bunable\b|\bcan'?t\b|\bcannot\b|\bdeclined?\b|\bdenied\b|\bsaid\s+no\b|\bturned\s+down\b|\bnot\s+approved\b/;

/**
 * Explicit approval language. Deliberately narrow — it must name the bank
 * approving, not merely contain the word "approved", because every negative
 * phrasing above contains "approved" too.
 */
const BANK_APPROVED_ALIASES =
  /\bpre[\s-]?approved\b|\bapproved\s+(?:at|by|with)\s+(?:the\s+)?bank\b|\bbank\s+approved\b/;

/**
 * Derive bankability from form data
 */
function deriveBankability(rawData: any): LeadBankability {
  const borrowerProfile = (rawData?.borrower_profile || '').toLowerCase();
  const bankStatus = (rawData?.bank_status || '').toLowerCase();
  const approved = rawData?.bank_approved;

  // Check the NEGATIVE first. Every declined phrasing contains the word
  // "approved", so a positive-first check reads them backwards.
  const isNotBankable = NOT_BANKABLE_ALIASES.test(borrowerProfile);

  if (isNotBankable || bankStatus === 'not_approved' || approved === false) {
    return 'not_approved';
  }

  // Positive requires explicit approval language AND no negation anywhere in
  // the profile. The negation guard is redundant given the early return above,
  // and deliberately so: it keeps this branch correct on its own if the order
  // is ever changed.
  if (
    (!isNotBankable && BANK_APPROVED_ALIASES.test(borrowerProfile)) ||
    bankStatus === 'approved' ||
    approved === true
  ) {
    return 'bank_approved';
  }

  if (borrowerProfile.includes('unsure') || bankStatus === 'unsure') {
    return 'unsure';
  }

  return 'unknown';
}

/**
 * Format phone number to E.164
 */
export function formatPhoneE164(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Handle North American numbers
  if (digits.length === 10) {
    // 10 digits: add +1 (Canada/US)
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // 11 digits starting with 1: add +
    return `+${digits}`;
  } else if (!digits.startsWith('+')) {
    // Other: assume it needs a +
    return `+${digits}`;
  }

  return phone; // Already formatted or unknown format
}
