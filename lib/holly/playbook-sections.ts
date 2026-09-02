/**
 * Segment-gated prompt sections for the autonomous decision prompt.
 *
 * The briefing (brain.ts) already withholds bankable programs and booking
 * hooks from alt_private leads, but the decision prompt in decision-engine.ts
 * layered three universal sections on top of it: a mandatory "Mortgage
 * Strategy Report" pre-sell, a cash-back re-engagement hook, and the selected
 * booking hook. On 2026-08-31 the alt_private test lead was sent the Strategy
 * Report pitch (rate-vs-cost) on Holly's fifth post-cancellation message.
 * These builders make the gate explicit and testable.
 */

export function buildReportPreSellSection(params: {
  isAltPrivate: boolean;
  hasUpcomingAppointment: boolean;
  /** alt_private lead with reverse-mortgage intent: no blocker, no "bank said no". */
  isReverse?: boolean;
}): string {
  if (params.hasUpcomingAppointment) {
    return 'This lead already has a booked call. The report pre-sell is not required. Focus on preparation and excitement.';
  }
  if (params.isAltPrivate && params.isReverse) {
    return `**🚨 THIS LEAD HAS NOT BOOKED A CALL YET (alt_private, reverse mortgage).**

Do NOT mention the Mortgage Strategy Report, rate comparisons, rate-vs-cost, penalties, cash back, or any bankable program. Those are the conventional playbook and they are off-playbook for this segment.

The reason to book is an unhurried, no-obligation information call: how accessing equity without a monthly mortgage payment works, and what it would mean for them. Nobody has said no to this lead and there is no blocker to diagnose. No urgency, no deadlines, and eligibility or suitability is the advisor's call, not yours.`;
  }
  if (params.isAltPrivate) {
    return `**🚨 THIS LEAD HAS NOT BOOKED A CALL YET (alt_private).**

Do NOT mention the Mortgage Strategy Report, rate comparisons, rate-vs-cost, penalties, cash back, or any bankable program. Those are the conventional playbook and they are off-playbook for this segment.

The reason to book is the call itself: 15 minutes to understand what the bank said no to, what the real blocker is, and whether a path exists with lenders beyond the banks. Frame it as understanding their situation, not a qualification pitch.`;
  }
  return `**🚨 THIS LEAD HAS NOT BOOKED A CALL YET.**

You MUST reference the personalised Mortgage Strategy Report in at least one message per conversation thread. This is not optional and not a suggestion.

Frame it as something built specifically for THEIR situation: their lender, their balance, their timeline. Not a generic document or calculator. The report is the concrete deliverable that makes booking the call worthwhile. Without it, you are asking them to give up 15 minutes for nothing tangible.

**Example framings (adapt to their situation):**
- "The strategy report shows your options with your current balance: rate comparisons, penalty calcs, the works. That's what the call walks through."
- "Before the call our team builds a personalised report for your situation, not a generic calculator. Most people say it's the first time they've seen the full picture."
- "You get a Mortgage Strategy Report before any big decisions. The call walks through what it shows, not a sales pitch."`;
}

export function buildCashBackSection(params: {
  isAltPrivate: boolean;
  outboundCount: number;
  inboundCount: number;
}): string {
  const { isAltPrivate, outboundCount, inboundCount } = params;
  if (isAltPrivate) {
    return `
## 🚫 NO BANKABLE HOOKS (alt_private)

**FORBIDDEN at every touch:** cash back, the Mortgage Strategy Report, rate-vs-cost reframes, or any bankable program. This segment's only hook is a short call to understand their situation.
`;
  }
  if (outboundCount >= 3 && inboundCount === 0) {
    return `
## 💰 CASH BACK RE-ENGAGEMENT HOOK (AVAILABLE — USE WITH CARE)

This lead has received ${outboundCount} messages with ZERO replies. A pattern interrupt is needed.

You MAY introduce the cash back angle to create curiosity. Example phrasings:
- "One more thing worth mentioning: depending on your situation there may be a cash back piece. Quick chat to see if it applies."
- "Quick note, some clients in your situation qualify for cash back. Our team can say in 5 minutes if you might."

**Rules:**
- NEVER guarantee eligibility. Always qualify with "depending on your situation" or "some clients qualify"
- NEVER explain how the program works over SMS. The details are in the Mortgage Strategy Report
- Create curiosity, earn the call. That's it.
`;
  }
  if (outboundCount < 3) {
    return `
## 🚫 CASH BACK RESTRICTION

**FORBIDDEN before touch 3:** Any mention of cash back, cash back program, or cash back eligibility. This lead has only received ${outboundCount} message${outboundCount !== 1 ? 's' : ''}. Cash back is a late-stage re-engagement tool only. Violations of this rule risk misleading leads about offers they may not qualify for.
`;
  }
  return '';
}

export function buildBookingHookLines(params: {
  isAltPrivate: boolean;
  hookName: string;
  hookAngle: string;
  isReverse?: boolean;
}): string {
  if (params.isAltPrivate && params.isReverse) {
    return `**Booking hook for this lead:** "Equity Without The Monthly Payment" (reverse mortgage). Dignity and options in retirement: access to equity they already own, without a monthly mortgage payment. Unhurried, no obligation, zero urgency, no declined framing. Whether it is available or suitable is the advisor's call.`;
  }
  if (params.isAltPrivate) {
    return `**Booking hook for this lead:** none (alt_private). The call is the value: understanding the blocker and whether a path exists. No report, no rate angle, no cash back.`;
  }
  return `**Booking hook selected for this lead:** "${params.hookName}"
Use this angle when pushing for a booking: ${params.hookAngle}`;
}
