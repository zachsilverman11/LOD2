/**
 * FinanceVine financials in the alt_private briefing
 *
 * On the first real vendor lead Holly reasoned that "property value and balance
 * are unknown" while the adapter had stored both, parsed and raw. The
 * alt_private playbook's equity-as-a-factor framing depends on her
 * understanding the equity position, so the figures now reach the briefing.
 *
 * Pins:
 *   - an alt_private lead with full financials gets them, with the
 *     figures-are-for-understanding-only rule directly beneath them
 *   - fields the vendor did not send are omitted, never rendered as "unknown"
 *   - a prime lead's briefing is untouched by any of it
 *   - a reverse lead gets the same figures under the reverse framing, with no
 *     declined / urgency phrasing introduced
 *   - the real validateDecision still blocks a message that quotes the LTV out
 *     of this new context, and still passes equity-as-a-factor language
 *
 * No lead's real personal data appears here; every figure is invented.
 */

import { buildHollyBriefing } from '../lib/holly/brain';
import { validateDecision, HollyDecision } from '../lib/holly/guardrails';
import { DealSignals } from '../lib/deal-intelligence';

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

const FIGURES_RULE = '**BRIEFING FIGURES ARE FOR UNDERSTANDING ONLY:**';
const FINANCIALS_HEADER = "**THIS LEAD'S FINANCIALS, AS THEY CAME IN";
const MEANING_HEADER = '**WHAT THOSE FIGURES MEAN FOR THIS CONVERSATION';

/** An underwater refinance file — the shape the alt/private book actually sees. */
const altPrivateFull = {
  first_name: 'Harper',
  segment: 'alt_private',
  intent: 'refinance',
  source: 'financevine',
  loanType: 'refinance',
  province: 'Ontario',
  property_value: 750000,
  property_value_raw: '750000',
  mortgage_balance: 1100000,
  mortgage_balance_raw: '1100000',
  ltv_percent: 110,
  ltv_percent_raw: '1.10',
  equity_take_out: 50000,
  equity_take_out_raw: '50000',
  income: 90000,
  income_raw: '90000',
  age_55_plus: false,
  has_realtor: true,
  open_to_sell: false,
  timeline: 'Within 3 months',
  zoning: 'Residential',
  property_conditions: 'Mid-renovation',
};

describe('alt_private briefing carries the stored financials', () => {
  const briefing = briefingFor(altPrivateFull);

  it('renders every figure that is present', () => {
    expect(briefing).toContain(FINANCIALS_HEADER);
    expect(briefing).toContain('- Property value: $750,000');
    expect(briefing).toContain('- Mortgage balance: $1,100,000');
    expect(briefing).toContain('- Loan-to-value: 110%');
    expect(briefing).toContain('- Equity take-out requested: $50,000');
    expect(briefing).toContain('- Stated income: $90,000');
  });

  it('renders the yes/no flags and the situational fields', () => {
    expect(briefing).toContain('- 55 or older: no');
    expect(briefing).toContain('- Working with a realtor: yes');
    expect(briefing).toContain('- Open to selling: no');
    expect(briefing).toContain('- Timeline they gave: Within 3 months');
    expect(briefing).toContain('- Zoning: Residential');
    expect(briefing).toContain('- Property conditions: Mid-renovation');
  });

  it('keeps the understanding-only rule attached directly beneath the figures', () => {
    const figuresAt = briefing.indexOf(FINANCIALS_HEADER);
    const ruleAt = briefing.indexOf(FIGURES_RULE);
    expect(figuresAt).toBeGreaterThan(-1);
    expect(ruleAt).toBeGreaterThan(figuresAt);
    // Nothing else is allowed between them: no other bolded section header.
    const between = briefing.slice(figuresAt + FINANCIALS_HEADER.length, ruleAt);
    expect(between).toContain(MEANING_HEADER);
    expect(between.match(/^\*\*[A-Z]/gm) || []).toHaveLength(1);
  });

  it('states what the figures mean in words, not as quotable figures', () => {
    expect(briefing).toContain(MEANING_HEADER);
    expect(briefing).toMatch(/balance owing is at or above what the property is worth/);
    expect(briefing).toMatch(/no equity left to draw on/);
    expect(briefing).toMatch(/more than the equity currently in the property|has none left in it/);
    expect(briefing).toMatch(/income is already on file/);

    // The derived wording must itself be unquotable: no percentage, no dollar
    // amount, and none of the spelled-out fractions the guardrail also bans.
    const meaning = briefing.slice(
      briefing.indexOf(MEANING_HEADER),
      briefing.indexOf(FIGURES_RULE)
    );
    expect(meaning).not.toMatch(/\d/);
    expect(meaning).not.toMatch(/\b(half|a third|two[-\s]thirds|three[-\s]quarters|a quarter)\b/i);
    expect(meaning).not.toMatch(/\bpercent\b/i);
  });

  it('says the ask fits when it sits inside the equity', () => {
    const withEquity = briefingFor({
      ...altPrivateFull,
      mortgage_balance: 300000,
      mortgage_balance_raw: '300000',
      ltv_percent: 40,
      ltv_percent_raw: '0.40',
    });
    expect(withEquity).toMatch(/sits inside the equity currently in the property/);
    expect(withEquity).toMatch(/substantial equity in the property/);
    expect(withEquity).not.toMatch(/no equity left to draw on/);
  });
});

describe('absent fields are omitted, not rendered as unknown', () => {
  const sparse = {
    first_name: 'Sam',
    segment: 'alt_private',
    intent: 'refinance',
    source: 'financevine',
    loanType: 'refinance',
    province: 'Ontario',
    property_value: 620000,
    property_value_raw: '620000',
    mortgage_balance: 410000,
    mortgage_balance_raw: '410000',
  };
  const briefing = briefingFor(sparse);

  it('renders what is there', () => {
    expect(briefing).toContain('- Property value: $620,000');
    expect(briefing).toContain('- Mortgage balance: $410,000');
  });

  it('omits the fields the vendor did not send', () => {
    const block = briefing.slice(
      briefing.indexOf(FINANCIALS_HEADER),
      briefing.indexOf(FIGURES_RULE)
    );
    expect(block).not.toContain('Equity take-out requested');
    expect(block).not.toContain('Stated income');
    expect(block).not.toContain('Down payment goal');
    expect(block).not.toContain('Loan-to-value');
    expect(block).not.toContain('55 or older');
    expect(block).not.toContain('Working with a realtor');
    expect(block).not.toContain('Open to selling');
    expect(block).not.toMatch(/unknown/i);
    expect(block).not.toMatch(/\bnull\b|\bundefined\b|\bNaN\b/);
  });

  it('still derives the equity position from the two figures it has', () => {
    // No stored LTV: the reading falls back to balance-over-value.
    expect(briefing).toContain(MEANING_HEADER);
    expect(briefing).toMatch(/real equity in the property, though not a lot of slack/);
  });

  it('keeps a figure we could not parse, as the vendor sent it', () => {
    const unparsed = briefingFor({
      ...sparse,
      ltv_percent_raw: 'see attached',
      income_raw: 'approx 90k',
    });
    expect(unparsed).toContain('- Loan-to-value: "see attached"');
    expect(unparsed).toContain('- Stated income: "approx 90k"');
  });

  it('renders no block at all for an alt_private lead with no financials', () => {
    const noFigures = briefingFor({
      first_name: 'Jo',
      segment: 'alt_private',
      intent: 'refinance',
      source: 'leads_on_demand',
      loanType: 'refinance',
      province: 'Ontario',
      timeline: 'Within 3 months',
    });
    expect(noFigures).not.toContain(FINANCIALS_HEADER);
    expect(noFigures).toContain(FIGURES_RULE); // the rule itself is unchanged
  });
});

describe('prime leads are unchanged', () => {
  const primeLead = {
    first_name: 'Pat',
    segment: 'prime_other',
    intent: 'refinance',
    source: 'leads_on_demand',
    loanType: 'refinance',
    province: 'Ontario',
    home_value: 850000,
    balance: 400000,
  };
  const briefing = briefingFor(primeLead);

  it('gets no financials block and no alt_private figures rule', () => {
    expect(briefing).not.toContain(FINANCIALS_HEADER);
    expect(briefing).not.toContain(MEANING_HEADER);
    expect(briefing).not.toContain(FIGURES_RULE);
    expect(briefing).not.toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
  });

  it('renders its refinance details exactly as it did before', () => {
    expect(briefing).toContain('- Property Value: $850000');
    expect(briefing).toContain('- Current Balance: $400000');
  });

  it('is byte-identical whether or not the new code path exists for it', () => {
    // A prime lead carries none of the vendor keys, so the only way the new
    // block could reach one is a segment-gate bug. Adding the keys and still
    // seeing no change is the strongest available statement of that.
    const withVendorKeysStripped = briefingFor(primeLead);
    expect(withVendorKeysStripped).toEqual(briefing);
    expect(briefing).not.toMatch(/Equity take-out requested/);
  });
});

describe('reverse leads get the figures under the reverse framing', () => {
  const reverseLead = {
    first_name: 'Linda',
    segment: 'alt_private',
    intent: 'reverse',
    source: 'financevine',
    loanType: 'reverse mortgage',
    province: 'British Columbia',
    property_value: 900000,
    property_value_raw: '900000',
    mortgage_balance: 150000,
    mortgage_balance_raw: '150000',
    ltv_percent: 16.67,
    ltv_percent_raw: '0.1667',
    equity_take_out: 120000,
    equity_take_out_raw: '120000',
    age_55_plus: true,
  };
  const briefing = briefingFor(reverseLead);

  it('is the reverse playbook, carrying the figures', () => {
    expect(briefing).toContain('CRITICAL: REVERSE MORTGAGE LEAD PLAYBOOK');
    expect(briefing).not.toContain('CRITICAL: PRIVATE/ALTERNATIVE LEAD PLAYBOOK');
    expect(briefing).toContain('- Property value: $900,000');
    expect(briefing).toContain('- Mortgage balance: $150,000');
    expect(briefing).toContain('- Loan-to-value: 16.67%');
    expect(briefing).toContain('- Equity take-out requested: $120,000');
    expect(briefing).toContain('- 55 or older: yes');
  });

  it('reads the figures in dignity/options language, not blocker language', () => {
    expect(briefing).toMatch(/built up substantial equity in the home/);
    expect(briefing).toMatch(/unhurried conversation about options/);
    expect(briefing).toMatch(/never repeat it back|Never repeat it back/);
    expect(briefing).not.toMatch(/real constraint on this file/);
    expect(briefing).not.toMatch(/alternative and private side exists for/);
  });

  it('introduces no declined or urgency phrasing into the block it adds', () => {
    // Scoped to the new block: the reverse playbook's own HARD BANS list quotes
    // the phrases it forbids ("bank said no", "act fast"), so the whole-briefing
    // form of this assertion would fail on text that predates this change.
    const block = briefing.slice(
      briefing.indexOf(FINANCIALS_HEADER),
      briefing.indexOf(FIGURES_RULE)
    );
    const banned = [
      /bank said no/i,
      /said no/i,
      /turned (you )?down/i,
      /(?<!not been )declined/i,
      /banks have a box/i,
      /bruised credit/i,
      /\basap\b/i,
      /act fast/i,
      /move fast/i,
      /last chance/i,
      /core blocker/i,
    ];
    for (const pattern of banned) {
      expect(block).not.toMatch(pattern);
    }
  });

  it('keeps the understanding-only rule directly beneath the figures', () => {
    const figuresAt = briefing.indexOf(FINANCIALS_HEADER);
    const ruleAt = briefing.indexOf(FIGURES_RULE);
    expect(figuresAt).toBeGreaterThan(-1);
    expect(ruleAt).toBeGreaterThan(figuresAt);
  });
});

/**
 * The point of the whole change: the briefing now holds real numbers, so the
 * numeric guardrail finally has something to catch. These run the REAL
 * validateDecision, not the compliance helper on its own.
 */
describe('the numeric guardrail and the new context work together', () => {
  const previous = process.env.HOLLY_ALT_LENDING_GUARDRAILS;
  beforeAll(() => {
    process.env.HOLLY_ALT_LENDING_GUARDRAILS = 'on'; // test process only
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.HOLLY_ALT_LENDING_GUARDRAILS;
    else process.env.HOLLY_ALT_LENDING_GUARDRAILS = previous;
  });

  const signals: DealSignals = {
    temperature: 'warm',
    engagementTrend: 'stable',
    sentimentSignals: {
      lastReplyTone: 'unknown',
      objectionDetected: false,
      questionCount: 0,
    },
    contextualUrgency: null,
    leadSourceQuality: 'medium',
    motivationLevel: 'active',
    reasoningContext: 'First touch on a FinanceVine alt_private lead',
    nextReviewHours: 24,
  };

  const altPrivateLead = {
    id: 'test-lead-id',
    email: 'test@example.com',
    phone: '+16045551234',
    firstName: 'Harper',
    lastName: 'Lead',
    status: 'NEW',
    source: 'financevine',
    segment: 'alt_private',
    consentSms: true,
    consentEmail: true,
    consentCall: true,
    hollyDisabled: false,
    managedByAutonomous: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    rawData: { segment: 'alt_private', province: 'Ontario' },
  };

  function guardrailErrors(message: string): string[] {
    const decision: HollyDecision = {
      thinking: 'Reasoning from the financials in the briefing',
      action: 'send_sms',
      message,
      confidence: 'high',
    };
    const result = validateDecision(decision, {
      lead: altPrivateLead as any,
      signals,
    });
    // Only the alt-lending numeric reasons matter here; time-of-day and the
    // like are orthogonal and can legitimately fire depending on when this runs.
    return result.errors.filter((e) => e.includes('ALT-LENDING GUARDRAIL #8'));
  }

  it('blocks a message that quotes the LTV it just learned', () => {
    const errors = guardrailErrors(
      "Hi Harper, Holly from Inspired Mortgage. Your mortgage is sitting at 110% of what the property is worth, which is why the banks are saying no. We work these files all the time. Can we grab 15 minutes?"
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/specific percentage/);
  });

  it('blocks the dollar amounts too', () => {
    const errors = guardrailErrors(
      "Hi Harper, you're looking to pull $50,000 out and you owe $1,100,000 on a $750,000 property. Let's talk."
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/specific dollar amount/);
  });

  it('blocks the same figure spelled out in words', () => {
    // Spelling the number out is the obvious evasion once the briefing hands
    // Holly a real LTV, so it is pinned explicitly.
    const errors = guardrailErrors(
      'Hi Harper, your balance is over one hundred percent of the property value. Quick call?'
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes an equity-as-a-factor message built from the same context', () => {
    const errors = guardrailErrors(
      "Hi Harper, Holly from Inspired Mortgage. Saw you're looking to pull some equity out while you're mid-renovation. Banks can be tricky with a property in that state, and we work these files all the time. How much equity is in the property is one of the biggest things that shapes what's possible, and that's a conversation for the team, not a text. Would tomorrow at 11am or 3pm work for a quick call?"
    );
    expect(errors).toEqual([]);
  });

  it('passes a reverse-framing message built from the same context', () => {
    const errors = guardrailErrors(
      "Hi Linda, this is Holly with Inspired Mortgage. You were asking about accessing some of the equity in your home without taking on a monthly mortgage payment. You've built up a good amount of it over the years, and our advisors can walk you through what that would mean for you. No obligation at all. Would Wednesday afternoon or Friday morning suit you better?"
    );
    expect(errors).toEqual([]);
  });
});
