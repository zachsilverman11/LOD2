/**
 * Reverse-mortgage framing inside the alt_private playbook
 *
 * Pins:
 *   - an alt_private lead with intent 'reverse' gets the reverse playbook and
 *     CTA, with no declined / urgency phrasing anywhere in the briefing
 *   - a non-reverse alt_private lead is unchanged (bank-said-no playbook)
 *   - the figures-are-for-understanding-only rule is in the base alt_private
 *     playbook on every attempt, reverse or not
 *   - deriveIntent returns 'reverse' for the vendor alias set, ahead of equity
 *   - the decision-prompt sections switch on isReverse too
 */

import { buildHollyBriefing, getConversationGuidance } from '../lib/holly/brain';
import { buildReportPreSellSection, buildBookingHookLines } from '../lib/holly/playbook-sections';
import { deriveLeadSegment } from '../lib/lead-segmentation';

const ctx = {
  touchNumber: 1,
  hasReplied: false,
  daysInPipeline: 0,
  messageHistory: '(No conversation yet)',
  lastMessageFrom: 'none' as const,
};

function briefingFor(leadData: Record<string, unknown>) {
  return buildHollyBriefing({ leadData, conversationContext: ctx, appointments: [] });
}

const reverseLead = {
  first_name: 'Linda',
  segment: 'alt_private',
  intent: 'reverse',
  source: 'financevine',
  loanType: 'reverse mortgage',
  province: 'British Columbia',
  property_value: 850000,
  mortgage_balance: 120000,
};
const equityLead = { ...reverseLead, first_name: 'Harper', intent: 'equity', loanType: 'refinance' };
const primeLead = { first_name: 'Pat', segment: 'prime_other', intent: 'refinance', loanType: 'refinance' };

// Phrases that must never reach a reverse-mortgage lead's briefing. Matched
// against the whole prompt so a stray sentence in any section fails the test.
const DECLINED_OR_URGENT = [
  /bank said no/i,
  /said no/i,
  /turned (you )?down/i,
  /(?<!not been )declined/i,
  /banks have a box/i,
  /don'?t fit the bank box/i,
  /bruised credit/i,
  /need funds asap/i,
  /\basap\b/i,
  /act fast/i,
  /move fast/i,
  /rates filling up/i,
  /spots filling up/i,
  /before options close/i,
  /last chance/i,
  /core blocker/i,
];

describe('reverse-mortgage alt_private lead', () => {
  const briefing = briefingFor(reverseLead);

  it('gets the reverse playbook, not the bank-said-no playbook', () => {
    expect(briefing).toContain('CRITICAL: REVERSE MORTGAGE LEAD PLAYBOOK');
    expect(briefing).not.toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
    expect(briefing).toMatch(/has usually NOT been declined by anyone/);
    expect(briefing).toMatch(/Dignity and options in retirement/);
    expect(briefing).toMatch(/without a monthly mortgage payment/);
    expect(briefing).toMatch(/Eligibility and suitability are advisor territory/);
  });

  it('gets the reverse CTA with binary-choice, unhurried scheduling', () => {
    expect(briefing).toContain('CALL-TO-ACTION FOR REVERSE MORTGAGE');
    expect(briefing).not.toContain('CALL-TO-ACTION FOR ALT_PRIVATE\n');
    expect(briefing).toMatch(/Equity Without The Monthly Payment/);
    expect(briefing).toMatch(/Would Wednesday afternoon or Friday morning suit you better/);
    expect(briefing).toMatch(/no obligation/i);
    expect(briefing).toMatch(/There is no rush on it/);
  });

  it('carries no declined or urgency phrasing anywhere outside the explicit bans', () => {
    // Strip the lines that name the banned phrases in order to ban them.
    const prose = briefing
      .split('\n')
      .filter((line) => !/^- ❌|^\*\*BAD EXAMPLE|^"Banks turned you down/.test(line.trim()))
      .join('\n');
    for (const pattern of DECLINED_OR_URGENT) {
      expect(prose).not.toMatch(pattern);
    }
  });

  it('keeps every alt_private suppression: no programs, the phrase bans, no cash back', () => {
    expect(briefing).toContain('PROGRAMS FOR THIS SEGMENT: NONE');
    expect(briefing).not.toContain('PROGRAMS YOU CAN MENTION');
    expect(briefing).not.toContain('BOOKING HOOK: "');
    expect(briefing).toMatch(/No "low rates", "ultra-low", "reserved rates", "no penalties", "guaranteed approval", "cash back", "best rate"/);
    expect(briefing).toMatch(/No "pull your credit", "see if you qualify"/);
    expect(briefing).toMatch(/No payout, borrowing, equity or dollar amounts/);
  });

  it('has the figures-are-for-understanding-only rule', () => {
    expect(briefing).toContain('BRIEFING FIGURES ARE FOR UNDERSTANDING ONLY');
    expect(briefing).toMatch(/never go in the message/);
    expect(briefing).toMatch(/numeric guardrail is a backstop, not the plan/);
  });

  it('reverse framing is keyed on intent, not on the segment alone', () => {
    const unknownIntent = briefingFor({ ...reverseLead, intent: undefined });
    expect(unknownIntent).toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
    expect(unknownIntent).not.toContain('REVERSE MORTGAGE LEAD PLAYBOOK');
  });

  it('a prime lead with reverse intent is not routed to the alt_private reverse playbook', () => {
    const prime = briefingFor({ ...primeLead, intent: 'reverse' });
    expect(prime).not.toContain('REVERSE MORTGAGE LEAD PLAYBOOK');
    expect(prime).toContain('PROGRAMS YOU CAN MENTION');
  });
});

describe('non-reverse alt_private lead is unchanged', () => {
  const briefing = briefingFor(equityLead);

  it('still gets the bank-said-no playbook and CTA', () => {
    expect(briefing).toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
    expect(briefing).not.toContain('REVERSE MORTGAGE LEAD PLAYBOOK');
    expect(briefing).toContain('Banks can be tricky');
    expect(briefing).toContain('CALL-TO-ACTION FOR ALT_PRIVATE');
    expect(briefing).not.toContain('CALL-TO-ACTION FOR REVERSE MORTGAGE');
    expect(briefing).toMatch(/Bank said no or borrower unsure/);
    expect(briefing).toMatch(/Normalizing that many files don't fit the bank box/);
  });

  it('now has the figures rule on the first attempt too', () => {
    expect(briefing).toContain('BRIEFING FIGURES ARE FOR UNDERSTANDING ONLY');
  });
});

describe('figures rule scope', () => {
  it('is not added to the prime playbook', () => {
    expect(briefingFor(primeLead)).not.toContain('BRIEFING FIGURES ARE FOR UNDERSTANDING ONLY');
  });
});

describe('decision-prompt sections switch on isReverse', () => {
  it('report pre-sell: reverse variant has no blocker or bank-said-no framing', () => {
    const reverse = buildReportPreSellSection({ isAltPrivate: true, isReverse: true, hasUpcomingAppointment: false });
    expect(reverse).toMatch(/reverse mortgage/);
    expect(reverse).toMatch(/Nobody has said no to this lead/);
    expect(reverse).not.toMatch(/what the bank said no to/);
    expect(reverse).toMatch(/Do NOT mention the Mortgage Strategy Report/);

    const plain = buildReportPreSellSection({ isAltPrivate: true, hasUpcomingAppointment: false });
    expect(plain).toMatch(/what the bank said no to/);
  });

  it('booking hook lines: reverse variant names the equity-without-payment hook', () => {
    const reverse = buildBookingHookLines({ isAltPrivate: true, isReverse: true, hookName: 'x', hookAngle: 'y' });
    expect(reverse).toMatch(/Equity Without The Monthly Payment/);
    expect(reverse).toMatch(/zero urgency, no declined framing/);
    const plain = buildBookingHookLines({ isAltPrivate: true, hookName: 'x', hookAngle: 'y' });
    expect(plain).toMatch(/none \(alt_private\)/);
  });

  it('touch-4+ zero-engagement guidance: reverse variant forbids urgency and declined framing', () => {
    const reverse = getConversationGuidance(4, false, true, true);
    expect(reverse.goal).toMatch(/reverse-mortgage lead/);
    expect(reverse.approach).not.toMatch(/bank said no/);
    expect(reverse.avoid.join(' ')).toMatch(/urgency/);
    expect(reverse.avoid.join(' ')).toMatch(/Declined/);
    const plain = getConversationGuidance(4, false, true);
    expect(plain.approach).toMatch(/what the bank said no to/);
    // Touches 1-3 are unchanged for everyone.
    expect(getConversationGuidance(2, false, true, true)).toBe(getConversationGuidance(2, false, false));
  });
});

describe('deriveIntent classifies reverse-mortgage aliases ahead of equity', () => {
  const aliases = [
    { mortgage_type: 'Reverse Mortgage' },
    { mortgage_type: 'Home Equity Conversion Mortgage' },
    { mortgage_type: 'Equity Release' },
    { mortgage_type: '55+ Equity Access' },
    { mortgage_type: 'CHIP Reverse Mortgage' },
    { mortgage_type: 'HECM' },
    { mortgage_type: 'Retirement Income Mortgage' },
    { mortgage_type: 'Seniors Equity Lending' },
    { primary_goal: 'access equity in retirement with a reverse mortgage' },
    { primary_goal: 'equity release, no monthly payment' },
    { age_55_plus: true, primary_goal: 'access equity' },
  ];

  it.each(aliases)('%o -> reverse', (rawData) => {
    expect(deriveLeadSegment({ source: 'financevine', rawData }).intent).toBe('reverse');
  });

  it('plain equity, refinance and purchase intents are untouched', () => {
    expect(deriveLeadSegment({ source: 'financevine', rawData: { primary_goal: 'take out equity' } }).intent).toBe('equity');
    expect(deriveLeadSegment({ source: 'financevine', rawData: { mortgage_type: 'refinance' } }).intent).toBe('refinance');
    expect(deriveLeadSegment({ source: 'financevine', rawData: { mortgage_type: 'purchase' } }).intent).toBe('purchase');
    expect(deriveLeadSegment({ source: 'financevine', rawData: { primary_goal: 'home equity line of credit' } }).intent).toBe('equity');
  });
});
