/**
 * Lead vertical classifier — deterministic, rule-based.
 *
 * ============================================================================
 * NOT WIRED IN. This module is imported by nothing outside its own test. It is
 * not called from any route, webhook, or ingestion path. Wiring it in is a
 * separate, deliberate step that depends on the vendor's payload spec.
 * ============================================================================
 *
 * WHY RULES AND NOT A MODEL — do not "improve" this with an LLM call:
 * The alt-lending numeric guardrail (lib/holly/guardrails.ts, Hard Guardrail #8
 * runtime half) is scoped on `vertical`. If a model decided `vertical`, then
 * compliance enforcement would become probabilistic rather than guaranteed —
 * a model that classifies an alt-lending lead as conventional silently
 * switches off the rule that stops Holly quoting rates, fees, LTVs, and payout
 * amounts to someone who was recently declined. Enforcement scope must be
 * decided by code you can read, test, and reason about exhaustively. No LLM
 * call, no heuristic scoring, no confidence thresholds.
 */

import type { Lead } from '@/app/generated/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadVertical = 'ALT_LENDING' | 'CONVENTIONAL';

/**
 * Derived from the VENDOR'S structured product field, not from the lead's
 * free-text conversation. That is the distinction that matters for the
 * reverse-mortgage short-circuit in alt-lending.draft.ts's
 * selectAltLendingBookingHook(): it keys on this value, so it no longer
 * depends on the lead happening to type "reverse mortgage" in a text.
 *
 * Normalizing the vendor string is still string matching, and it is only as
 * good as its alias list — see REVERSE_MORTGAGE_ALIASES below and treat any
 * new vendor's product vocabulary as something to check, not assume.
 */
export type LeadProductType =
  | 'REVERSE_MORTGAGE'
  | 'HOME_EQUITY'
  | 'REFINANCE'
  | 'RENEWAL'
  | 'PURCHASE'
  | 'UNKNOWN';

/** The vendor's answer to "can you get approved at a bank?" */
export type BankApprovalStatus =
  | 'CANNOT_GET_APPROVED'
  | 'UNSURE'
  | 'CAN_GET_APPROVED';

/**
 * Normalized lead data. Every field optional: vendors differ in what they
 * send, and the whole point of the ambiguity rule below is to behave safely
 * when fields are absent.
 */
export interface ClassifierInput {
  /** Vendor identifier, matching the existing `Lead.source` value space. */
  source?: string | null;
  bankApprovalStatus?: BankApprovalStatus | null;
  /** Raw vendor mortgage-type string; normalized internally. */
  mortgageType?: string | null;
  age?: number | null;
  /** Some vendors send a bracket ("55+", "55-64") rather than an age. */
  ageBracket?: string | null;
  /** True when the lead is explicitly comparing rates across lenders. */
  rateShopping?: boolean | null;
  province?: string | null;
}

export interface Classification {
  vertical: LeadVertical;
  productType: LeadProductType;
  /**
   * Short human-readable record of WHY this classification was reached, for
   * logging and later auditing. Never empty — every branch sets one, and the
   * test suite asserts it.
   */
  reason: string;
}

// ---------------------------------------------------------------------------
// Source-level defaults
// ---------------------------------------------------------------------------

/**
 * A source supplies a DEFAULT vertical, used only when per-lead signals are
 * too thin to decide. Per-lead rules refine this default — the source never
 * hardcodes the answer, and contradictory per-lead signals override it
 * entirely (see classifyLead).
 *
 * Keys are compared lowercase against `Lead.source`. Only sources that have
 * been deliberately reviewed belong here; an unregistered or missing source
 * falls through to the restrictive default (ALT_LENDING), NOT to conventional.
 *
 * rates.ca is deliberately absent. It is not integrated yet and no
 * source-specific logic should be written for it until its payload is known —
 * the shape is open, that is all.
 */
export const SOURCE_VERTICAL_DEFAULTS: Readonly<Record<string, LeadVertical>> = {
  financevine: 'ALT_LENDING',
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Reverse-mortgage vendor vocabulary. These MUST be tested before the equity
 * branch: "Home Equity Conversion Mortgage" (HECM's full legal name) and
 * "Equity Release" both contain "equity" and none of them contain "reverse".
 * Bucketing one of those as HOME_EQUITY let a 55+ reverse lead fall through to
 * CONVENTIONAL — the exact compliance failure this module exists to prevent.
 * Add to this list whenever a new vendor's product vocabulary is onboarded.
 */
const REVERSE_MORTGAGE_ALIASES =
  /reverse|home\s*equity\s*conversion|\bhecm\b|equity\s*release|\bchip\b|retirement\s*income\s*mortgage|senior[s]?\s*(equity|lending)/;

/**
 * Product strings that are inherently alt-lending regardless of what the
 * vendor claims about bank approvability. A "B-lender refinance" or a "private
 * second mortgage" is alt-lending by definition — the string says so.
 */
const INHERENTLY_ALT_PRODUCT =
  /\bb[-\s]?lender\b|\bprivate\b|\bsecond\s*mortgage\b|\bmic\b|\bbridge\s*(loan|financing)\b|\balt(ernative)?\s*(lender|lending)\b/;

function normalizeProductType(raw?: string | null): LeadProductType {
  if (!raw) return 'UNKNOWN';
  const v = raw.toLowerCase().replace(/[_-]+/g, ' ').trim();
  // Reverse first — see REVERSE_MORTGAGE_ALIASES.
  if (REVERSE_MORTGAGE_ALIASES.test(v)) return 'REVERSE_MORTGAGE';
  // "Buyout" (spousal buyout) is a refinance, not a purchase, so it is matched
  // here before the /buy/ branch below could claim it.
  if (/buy\s?out|buyout/.test(v)) return 'REFINANCE';
  if (/equity|heloc|take\s?out|takeout|second/.test(v)) return 'HOME_EQUITY';
  if (/refinance|refi/.test(v)) return 'REFINANCE';
  if (/renew/.test(v)) return 'RENEWAL';
  if (/purchase|buy|new home|first time/.test(v)) return 'PURCHASE';
  return 'UNKNOWN';
}

/** True when the vendor's product string is itself an alt-lending tell. */
function isInherentlyAltProduct(raw?: string | null): boolean {
  if (!raw) return false;
  return INHERENTLY_ALT_PRODUCT.test(raw.toLowerCase().replace(/[_-]+/g, ' ').trim());
}

/**
 * Parses an age bracket to a boolean "is 55+", or null when it cannot be read
 * confidently. Two bugs this guards against, both found in review:
 *  - "under 55" / "less than 55" grabbed the 55 and reported "confirmed 55+",
 *    recording a false fact in the audit `reason`.
 *  - "100+" matched the first two digits ("10") and read as under 55.
 * Returns null rather than guessing, so the caller falls through to the
 * age-absent branch, which is already restrictive.
 */
function parseBracketIs55Plus(bracket: string): boolean | null {
  const b = bracket.toLowerCase().trim();
  const negated = /\b(under|below|less than|younger than|<)\b|^</.test(b);
  const m = b.match(/\d{2,3}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (!Number.isFinite(n)) return null;
  // "under 55" means <55; "under 70" also means the lower bound is unknown, so
  // only treat a negated bracket as a definite answer when it excludes 55+.
  if (negated) return n <= 55 ? false : null;
  return n >= 55;
}

/** Returns true only when we affirmatively know the lead is 55+. */
function isFiftyFivePlus(input: ClassifierInput): boolean {
  if (typeof input.age === 'number' && Number.isFinite(input.age)) {
    return input.age >= 55;
  }
  if (input.ageBracket) return parseBracketIs55Plus(input.ageBracket) === true;
  return false;
}

/** Returns true only when we affirmatively know the lead is UNDER 55. */
function isKnownUnder55(input: ClassifierInput): boolean {
  if (typeof input.age === 'number' && Number.isFinite(input.age)) {
    return input.age < 55;
  }
  if (input.ageBracket) return parseBracketIs55Plus(input.ageBracket) === false;
  return false;
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * AMBIGUITY RULE — FAIL TO THE RESTRICTIVE SIDE. DO NOT "OPTIMISE" THIS.
 *
 * When signals are missing, thin, or contradictory, this returns ALT_LENDING.
 * That is not conservatism for its own sake; the failure costs are asymmetric:
 *
 *   - Conventional lead misclassified as alt-lending: Holly uses solution-
 *     framing hooks instead of rate-comparison hooks. Costs some hook
 *     effectiveness. Recoverable, and invisible to compliance.
 *
 *   - Alt-lending lead misclassified as conventional: the alt-lending
 *     guardrail does not run, so Holly may quote a specific rate, fee, LTV, or
 *     payout amount to someone who was recently declined by a bank — or to a
 *     55+ reverse-mortgage lead. That is the failure that actually harms a
 *     person and creates liability for the brokerage.
 *
 * A wrong hook is a marketing cost. A wrong guardrail scope is a compliance
 * incident. Anyone tempted to flip the default to conventional "because most
 * leads are conventional" is trading the second failure for the first.
 */
export function classifyLead(input: ClassifierInput): Classification {
  const productType = normalizeProductType(input.mortgageType);
  const approval = input.bankApprovalStatus ?? null;
  const sourceKey = (input.source ?? '').toLowerCase().trim();
  const sourceDefault: LeadVertical | undefined = SOURCE_VERTICAL_DEFAULTS[sourceKey];

  // --- Rule 0: signals that OVERRIDE a bank-approvable claim. ---
  // Previously `CAN_GET_APPROVED` was trusted absolutely: nothing could pull a
  // lead back to alt-lending once the vendor asserted it. That is unsafe in two
  // real cases, both of which resolve restrictive under the ambiguity rule:
  //   (a) the product string is itself an alt-lending tell ("B-lender
  //       refinance", "private second mortgage") — the vendor's own words
  //       contradict the approvability claim;
  //   (b) the source is registered as an ALT_LENDING vendor, whose entire book
  //       is declined or unsure borrowers, yet this lead claims approvable —
  //       a conflict between two vendor-supplied fields.
  // Neither is resolved toward the permissive side.
  if (approval === 'CAN_GET_APPROVED') {
    if (isInherentlyAltProduct(input.mortgageType)) {
      return {
        vertical: 'ALT_LENDING',
        productType,
        reason: `Contradictory: borrower reported "CAN_GET_APPROVED" but the product ("${input.mortgageType}") is inherently alt-lending. Classified alt-lending per the ambiguity rule.`,
      };
    }
    if (sourceDefault === 'ALT_LENDING') {
      return {
        vertical: 'ALT_LENDING',
        productType,
        reason: `Contradictory: borrower reported "CAN_GET_APPROVED" but source "${sourceKey}" is a registered alt-lending vendor. Classified alt-lending per the ambiguity rule.`,
      };
    }
  }

  // Product string is an alt-lending tell even without an approval answer.
  if (isInherentlyAltProduct(input.mortgageType)) {
    return {
      vertical: 'ALT_LENDING',
      productType,
      reason: `Product ("${input.mortgageType}") is inherently alt-lending (private / B-lender / second mortgage).`,
    };
  }

  // --- Rule 1: reverse mortgage. Structurally alt-lending regardless of
  // approval status — this audience is usually NOT declined, they are 55+
  // homeowners accessing equity, and they must still be inside the guardrail.
  if (productType === 'REVERSE_MORTGAGE') {
    if (isFiftyFivePlus(input)) {
      return {
        vertical: 'ALT_LENDING',
        productType,
        reason: 'Reverse mortgage product with confirmed 55+ age signal.',
      };
    }
    if (isKnownUnder55(input)) {
      // Contradictory: reverse mortgages require 55+. Trust neither field;
      // fail restrictive.
      return {
        vertical: 'ALT_LENDING',
        productType,
        reason:
          'Contradictory: reverse mortgage product but age signal is under 55. Defaulting to alt-lending per the ambiguity rule; advisor to confirm eligibility.',
      };
    }
    return {
      vertical: 'ALT_LENDING',
      productType,
      reason: 'Reverse mortgage product; age signal absent, treated as alt-lending.',
    };
  }

  // --- Rule 2: the qualifying answer for this vertical. Cannot be approved at
  // a bank, or unsure. Covers equity take-out / refinance / renewal with that
  // profile.
  if (approval === 'CANNOT_GET_APPROVED' || approval === 'UNSURE') {
    // Contradiction worth recording, not resolving: a borrower who says they
    // cannot get bank approval while also rate-shopping across lenders. The
    // outcome is alt-lending either way — the reason string carries the
    // conflict forward so an auditor can see it was noticed, not missed.
    const conflicted = approval === 'CANNOT_GET_APPROVED' && input.rateShopping === true;
    return {
      vertical: 'ALT_LENDING',
      productType,
      reason: conflicted
        ? `Contradictory: borrower reported "CANNOT_GET_APPROVED" but is also rate-shopping. Classified alt-lending per the ambiguity rule.`
        : `Borrower reported "${approval}" for bank approval${
            productType !== 'UNKNOWN' ? ` on a ${productType} product` : ''
          }.`,
    };
  }

  // --- Rule 3: the only affirmative route to conventional. Requires POSITIVE
  // evidence on both axes: bank-approvable AND a known, non-reverse product.
  // Absence of a signal is never treated as evidence of conventionality.
  if (approval === 'CAN_GET_APPROVED' && productType !== 'UNKNOWN') {
    return {
      vertical: 'CONVENTIONAL',
      productType,
      reason: `Bank-approvable on a conventional ${productType} product${
        input.rateShopping ? ', rate-shopping confirmed' : ''
      }.`,
    };
  }

  // --- Rule 4: signals insufficient. Source default refines, if the source
  // has been deliberately registered; otherwise the restrictive default.
  // Note CAN_GET_APPROVED with an UNKNOWN product lands here deliberately:
  // "bank-approvable" alone is not enough to earn conventional treatment.
  if (sourceDefault) {
    return {
      vertical: sourceDefault,
      productType,
      reason: `Per-lead signals insufficient; applied registered source default for "${sourceKey}".`,
    };
  }

  return {
    vertical: 'ALT_LENDING',
    productType,
    reason:
      'Insufficient or absent signals and no registered source default. Defaulting to alt-lending per the ambiguity rule (fail restrictive).',
  };
}

// ---------------------------------------------------------------------------
// Read-side helper
// ---------------------------------------------------------------------------

/**
 * `Lead.vertical` is nullable and was NOT backfilled. Every lead predating the
 * column is known-conventional, so NULL reads as CONVENTIONAL.
 *
 * NOTE this is NOT the ambiguity case above, and the two must not be conflated:
 *   - NULL here means "row predates the column" — a known, safe fact.
 *   - The ambiguity rule handles "we have a lead and cannot tell what it is" —
 *     an unknown, which resolves to ALT_LENDING.
 * Reading NULL as alt-lending would wrongly pull the entire existing book into
 * the alt-lending guardrail; resolving an unknown to conventional would
 * wrongly drop a declined borrower out of it.
 */
export function readLeadVertical(
  lead: Pick<Lead, 'source'> & { vertical?: string | null },
): LeadVertical {
  const v = (lead.vertical ?? '').toUpperCase().trim();
  if (v === 'ALT_LENDING') return 'ALT_LENDING';
  if (v === 'CONVENTIONAL') return 'CONVENTIONAL';
  return 'CONVENTIONAL';
}

/**
 * ============================================================================
 * FUTURE NEED — FLAGGED, NOT BUILT (do not implement here):
 *
 * MID-CONVERSATION RECLASSIFICATION. A lead classified CONVENTIONAL at
 * ingestion may later reveal a bank decline mid-thread ("the bank turned me
 * down last week"). Today nothing re-evaluates `Lead.vertical` after
 * ingestion, so that lead stays conventional — and therefore outside the
 * alt-lending guardrail — for the rest of the conversation.
 *
 * When this is built it MUST be an explicit, logged transition that writes
 * back to `Lead.vertical` with a recorded reason and timestamp, never silent
 * drift and never a per-message in-memory override. Two reasons: the guardrail
 * scope has to be reconstructable after the fact for any compliance question,
 * and a vertical that changes invisibly between messages makes Holly's
 * behaviour non-reproducible when debugging a bad send.
 *
 * Direction of travel should also be constrained — CONVENTIONAL -> ALT_LENDING
 * on a decline signal is safe; the reverse is a widening of what Holly may say
 * and should require more than a passing remark.
 * ============================================================================
 */
