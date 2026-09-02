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
    rawData?.age_55_plus === true
  ) {
    return 'reverse';
  }

  // Check for equity take-out
  if (
    primaryGoal.includes('equity') ||
    primaryGoal.includes('cash') ||
    primaryGoal.includes('consolidate') ||
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
 * Derive bankability from form data
 */
function deriveBankability(rawData: any): LeadBankability {
  const borrowerProfile = (rawData?.borrower_profile || '').toLowerCase();
  const bankStatus = (rawData?.bank_status || '').toLowerCase();
  const approved = rawData?.bank_approved;

  // Check explicit fields
  if (borrowerProfile.includes('approved at bank') || bankStatus === 'approved' || approved === true) {
    return 'bank_approved';
  }

  if (
    borrowerProfile.includes('not approved') ||
    borrowerProfile.includes('bank said no') ||
    bankStatus === 'not_approved' ||
    approved === false
  ) {
    return 'not_approved';
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
