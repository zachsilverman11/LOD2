/**
 * Unit tests for the alt-lending runtime guardrail (Hard Guardrail #8, numeric half).
 *
 * Run: npx tsx scripts/test-alt-lending-guardrails.ts
 *
 * Covers four things:
 *  1. Violations ARE caught by checkAltLendingNumericCompliance().
 *  2. Deliberate carve-outs are NOT caught — including every message string
 *     shipped in the alt-lending draft copy, which must pass clean.
 *  3. The enforcement is genuinely default-off and double-gated on the
 *     alt_private SEGMENT (not the dead `vertical` axis it used to read).
 *  4. End-to-end through validateDecision(): an alt_private lead from any
 *     source is covered, a prime_other lead is not, the flag off disables
 *     everything regardless of segment, and the numeric block coexists with
 *     main's alt_private banned-phrase block without breaking a carve-out.
 */

import {
  checkAltLendingNumericCompliance,
  isAltLendingNumericGuardrailEnabled,
  isAltPrivateSegment,
  validateDecision,
  HollyDecision,
} from '../lib/holly/guardrails';

/**
 * Fixtures are inline literals, deliberately.
 *
 * They used to be scraped out of lib/holly/verticals/alt-lending.draft.ts with
 * readFileSync + a regex. That module was deleted on 2026-09-03, and a test
 * that silently loses its corpus when a file disappears is worse than one that
 * pins the copy it cares about — which is why these were inlined first. These are the 16 message/hook/nudge literals
 * as of bc42cfe — they are the realistic alt-lending copy this guardrail must
 * never false-positive on.
 */
const DRAFT_COPY_FIXTURES: Array<{ label: string; text: string }> = [
  { label: 'message #1', text: "Hi Sarah — it's Holly with Inspired Mortgage. FinanceVine just let you know you'd been matched with a broker — that's us, and I'm following up from our own office number so everything stays in one place. You mentioned you're looking to consolidate some higher-interest debt using the equity in your home — that's a big part of what our advisors do, and they work with lenders well beyond the big banks. Want to grab 15 minutes with one of them? No obligation. Tomorrow 11am or 3pm?" },
  { label: 'message #2', text: "Hi Dave — Holly here from Inspired Mortgage. Following up on the FinanceVine text about being matched with a broker — that's us, just messaging from our own number. You'd asked about pulling some cash out of the house for renovations. Our advisors can walk you through what that actually looks like for your situation, no obligation either way. Does Thursday morning or Friday afternoon work better for a quick 15?" },
  { label: 'message #3', text: "Hi Marc — it's Holly with Inspired Mortgage, picking up from the FinanceVine text about being matched with a broker (new number, same team). You mentioned you've fallen behind on payments and the bank wasn't much help. That's a more common spot than people think, and it's exactly the kind of file our advisors take on — they work with lenders the banks never mention. Can we get you 15 minutes with one of them? I've got tomorrow at 10am or 2pm." },
  { label: 'message #4', text: "Hi Linda — this is Holly with Inspired Mortgage. FinanceVine let you know you'd been matched with a broker; I'm following up on that from our own number. You were asking about accessing some of the equity in your home without taking on a monthly mortgage payment. Our advisors can walk you through how that works and what it would mean for you — just an information call, no obligation at all. Would Wednesday afternoon or Friday morning suit you better? Or I can send you our calendar link and you pick whatever time works — whichever you prefer." },
  { label: 'hookMessage #5', text: "A bank saying no isn't the same as there being no options — banks can only lend within pretty rigid boxes. Our advisors work with lenders built for exactly this kind of situation. Worth 15 minutes to see what's actually possible for you?" },
  { label: 'followUpNudge #6', text: "Still thinking it over? Totally get it after a bank says no — but it's worth knowing what else is out there before you rule anything out. 15 minutes, no pressure." },
  { label: 'hookMessage #7', text: "Self-employed income trips up a lot of standard bank applications because they're built around T4 employees. Our advisors deal with this constantly and look at it differently. Want to see what your options actually look like?" },
  { label: 'followUpNudge #8', text: "Self-employment shouldn't be the thing that closes doors on a mortgage — it usually just means a different lender, not no lender. Happy to set up a quick call whenever works." },
  { label: 'hookMessage #9', text: "Credit history is one factor among several private and alternative lenders weigh — it's rarely a hard stop the way it can be with a bank. Our advisors can give you a clear, honest read on where you stand. Worth a quick call?" },
  { label: 'followUpNudge #10', text: "No pressure on this — but most people are surprised by what's actually available once an advisor looks at the full picture, not just the credit score. Want me to set up a time?" },
  { label: 'hookMessage #11', text: "Given your timeline, speed matters more than shopping around for the lowest number. Our advisors can move quickly with lenders who don't need the same drawn-out underwriting a bank does. Can we grab 15 minutes today or tomorrow?" },
  { label: 'followUpNudge #12', text: "Still on a tight timeline? The sooner we get an advisor on this, the more options stay open. Want me to grab you a time today?" },
  { label: 'hookMessage #13', text: "In private lending, how much equity you have in the property is one of the biggest things that opens up options — it matters a lot more than it would with a bank. An advisor can look at your specific numbers and tell you exactly what's available. Worth 15 minutes?" },
  { label: 'followUpNudge #14', text: "Just checking back — equity is one of the biggest factors in what's available here, and it's worth knowing your specific numbers even if you end up going another way. Happy to set up a quick call whenever works for you." },
  { label: 'hookMessage #15', text: "A reverse mortgage lets you access some of the equity you've already built in your home without taking on a monthly mortgage payment — that's the piece most people are surprised by. Whether it fits your situation is really a conversation with an advisor, and there's no obligation in having it. Would sometime this week work, or would you rather pick a time yourself from our calendar?" },
  { label: 'followUpNudge #16', text: "No rush at all on this — whenever you'd like to understand how it works and what it would mean for you, our advisors are happy to walk through it. Just say the word and I'll set up a time, or I can send you the link to choose your own." },
];

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function shouldFlag(label: string, message: string) {
  const errors = checkAltLendingNumericCompliance(message);
  check(`FLAGGED: ${label}`, errors.length > 0, `no violation raised for: "${message}"`);
}

function shouldPass(label: string, message: string) {
  const errors = checkAltLendingNumericCompliance(message);
  check(`CLEAN:   ${label}`, errors.length === 0, `false positive: ${errors.join(' | ')}`);
}

console.log('\n=== 1. VIOLATIONS MUST BE CAUGHT ===\n');

// Interest rates
shouldFlag('decimal rate', 'Our private lenders are around 8.99% right now.');
shouldFlag('integer rate', 'You are looking at roughly 9% on a private second.');
shouldFlag('spelled percent', 'Expect about 9 percent on this kind of deal.');

// LTV
shouldFlag('LTV percentage', 'Most private lenders will go to 80% LTV.');
shouldFlag('LTV acronym, no number', 'The LTV is what really drives this.');
shouldFlag('loan-to-value spelled out', 'Loan-to-value is the piece that decides it.');
shouldFlag('percent of home value', 'You can usually pull up to 75% of your home value.');

// Dollar amounts
shouldFlag('dollar figure', 'You could likely access $150,000 in equity.');
shouldFlag('k shorthand', 'That should free up about 80k for you.');
shouldFlag('thousand spelled', 'You could take out 50 thousand.');
shouldFlag('words-only amount', 'You could access fifty thousand from the home.');
shouldFlag('reverse mortgage payout', 'A reverse mortgage would give you around $200,000 tax free.');

// Fees
shouldFlag('fee with figure', 'The lender fee is usually 2 points on these.');
shouldFlag('closing costs figure', 'Closing costs run about 3,000 on a file like this.');

// Approval likelihood
shouldFlag('probably qualify', "Based on what you've told me you'll probably qualify.");
shouldFlag('should be fine', "You've got lots of equity so that should be fine.");
shouldFlag('shouldn\'t be a problem', "Bruised credit shouldn't be a problem here.");
shouldFlag('no trouble getting', "We'll have no trouble getting you approved.");
shouldFlag('guaranteed approval', 'This is basically guaranteed approval with your equity.');
shouldFlag('confident you qualify', "I'm confident you will qualify for this.");
shouldFlag('should be able to', 'You should be able to qualify with that much equity.');

console.log('\n=== 2. CARVE-OUTS MUST NOT BE CAUGHT ===\n');

// The approved equity-as-a-factor sentence, verbatim from Hard Guardrail #8.
shouldPass(
  'approved equity-as-a-factor phrasing (verbatim)',
  "In private lending, how much equity you have in the property is one of the biggest things that opens up options — it matters a lot more than it would with a bank. An advisor can look at your specific numbers and tell you exactly what's available."
);

// General rate talk is explicitly allowed — this vertical is not rate-silent.
shouldPass('general rate phrasing', 'Our advisors work with lenders beyond the big banks and can get you fair rates.');
shouldPass('competitive options', 'There are competitive options out there that a bank would never mention.');

// Empathy and lender access must survive untouched.
shouldPass(
  'empathy language',
  "A bank saying no isn't the same as there being no options — banks can only lend within pretty rigid boxes."
);
shouldPass('lender access', 'Our advisors have access to 30+ lenders, including private and alternative ones.');

// Ordinary non-financial numbers.
shouldPass('duration', 'Worth 15 minutes to see what is actually possible?');
shouldPass('appointment times', 'Would tomorrow at 11am or 3pm suit you better?');
shouldPass('age reference', 'Reverse mortgages are available to homeowners 55+.');
shouldPass('100% emphasis', 'This call is 100% free and there is no obligation at all.');
shouldPass('100% no obligation', "It's 100% no obligation — just an information call.");

// Redirect language from the guardrail itself.
shouldPass(
  'guardrail redirect phrasing',
  "That's exactly what the advisor will work through with you on the call — it depends on specifics they'll need to look at."
);

console.log('\n=== 2b. EVERY SHIPPED DRAFT MESSAGE MUST PASS CLEAN ===\n');

check(
  'fixture corpus is intact (16 messages)',
  DRAFT_COPY_FIXTURES.length === 16,
  `found ${DRAFT_COPY_FIXTURES.length}`
);
for (const { label, text } of DRAFT_COPY_FIXTURES) {
  shouldPass(`draft ${label}: "${text.slice(0, 48)}..."`, text);
}

console.log('\n=== 2c. REGRESSIONS FROM ADVERSARIAL REVIEW — FALSE POSITIVES ===\n');
// Each of these was wrongly BLOCKED by the first version of the check.
shouldPass('no fee + duration', "There's no fee for the call — 15 minutes with an advisor, no obligation.");
shouldPass('no closing costs + duration', 'There are no closing costs to discuss on a 20 minute intro call.');
shouldPass('zero dollars', 'It costs you $0 to speak with an advisor.');
shouldPass('$0.00', 'The consultation is $0.00 — genuinely no obligation.');
shouldPass('100% Canadian-owned', 'Our team is 100% Canadian-owned and independent.');
shouldPass('100% confident', "I'm 100% confident an advisor is the right next step here.");
shouldPass('fee-free framing', 'The call is fee-free and takes about 15 minutes.');
shouldPass('doesn\'t cost anything', "Talking to an advisor doesn't cost you anything.");
shouldPass('see what you qualify for', 'Worth a quick call to see what you qualify for.');
shouldPass('if you qualify', "The advisor will tell you if you qualify and what for.");

console.log('\n=== 2d. REGRESSIONS FROM ADVERSARIAL REVIEW — MISSES ===\n');
// Each of these wrongly PASSED the first version of the check.
shouldFlag('we can definitely get approved', 'We can definitely get this approved.');
shouldFlag('approval is very likely', 'Approval is very likely in your situation.');
shouldFlag('bare "you qualify"', 'You qualify for this.');
shouldFlag('won\'t be an issue', "That won't be an issue at all.");
shouldFlag('going to work out fine', 'This is going to work out fine for you.');
shouldFlag('spelled percent LTV', 'Private lenders will often lend up to eighty percent of your property value.');
shouldFlag('spelled rate fraction', 'Most files like yours get done at around six and a half.');
shouldFlag('high single digits', 'Rates for these are in the high single digits.');
shouldFlag('spelled fee range', 'Expect fees in the two to three range.');
shouldFlag('word-form LTV estimate', "You'd need roughly half the value of your home in equity.");
shouldFlag('100% LTV still caught', 'Some lenders will go to 100% LTV on these.');
shouldFlag('100% of home value still caught', 'You could borrow 100% of your home value.');

console.log('\n=== 3. FLAG IS DEFAULT-OFF AND DOUBLE-GATED ===\n');

delete process.env.HOLLY_ALT_LENDING_GUARDRAILS;
check('unset env => enforcement OFF', isAltLendingNumericGuardrailEnabled() === false);

for (const value of ['', 'off', 'false', 'true', 'yes', '1', 'ON', 'On']) {
  process.env.HOLLY_ALT_LENDING_GUARDRAILS = value;
  check(
    `env "${value}" => enforcement OFF (only exact 'on' enables)`,
    isAltLendingNumericGuardrailEnabled() === false
  );
}

process.env.HOLLY_ALT_LENDING_GUARDRAILS = 'on';
check("env 'on' => enforcement ON", isAltLendingNumericGuardrailEnabled() === true);
delete process.env.HOLLY_ALT_LENDING_GUARDRAILS;

// Second gate: the lead's segment must be alt_private.
check('no segment anywhere => not alt_private', isAltPrivateSegment({ lead: {} }) === false);
check('null lead => not alt_private', isAltPrivateSegment({ lead: null }) === false);
check('undefined lead => not alt_private', isAltPrivateSegment({}) === false);
check('segment column alt_private => alt_private', isAltPrivateSegment({ lead: { segment: 'alt_private' } }) === true);
check('rawData segment alt_private => alt_private', isAltPrivateSegment({ lead: { rawData: { segment: 'alt_private' } } }) === true);
check('column wins over rawData', isAltPrivateSegment({ lead: { segment: 'alt_private', rawData: { segment: 'prime_other' } } }) === true);
check('prime_other => not alt_private', isAltPrivateSegment({ lead: { segment: 'prime_other' } }) === false);
check('prime_rate_shop => not alt_private', isAltPrivateSegment({ lead: { segment: 'prime_rate_shop' } }) === false);
check('case-sensitive: ALT_PRIVATE => not alt_private', isAltPrivateSegment({ lead: { segment: 'ALT_PRIVATE' } }) === false);
check('unrelated rawData => not alt_private', isAltPrivateSegment({ lead: { rawData: { province: 'British Columbia' } } }) === false);

console.log('\n=== 4. END-TO-END THROUGH validateDecision() ===\n');

/**
 * Minimal lead that clears every unrelated hard rule in validateDecision():
 * consented, not Finmo-managed, never contacted (so no anti-spam block), and
 * in a province whose local time we pin to mid-morning below.
 */
function leadFixture(overrides: Record<string, any> = {}): any {
  return {
    id: 'test-lead',
    firstName: 'Test',
    lastName: 'Lead',
    status: 'CONTACTED',
    consentSms: true,
    hollyDisabled: false,
    lastContactedAt: null,
    communications: [],
    appointments: [],
    rawData: { province: 'British Columbia' },
    segment: null,
    ...overrides,
  };
}

function sms(message: string): HollyDecision {
  return { thinking: 'test', action: 'send_sms', message, confidence: 'high' };
}

function numericErrors(v: { errors: string[] }): string[] {
  return v.errors.filter((e) => e.startsWith('ALT-LENDING GUARDRAIL #8'));
}

function banErrors(v: { errors: string[] }): string[] {
  return v.errors.filter((e) => e.includes('alt_private segment violation'));
}

// A numeric violation that trips ONLY the new guardrail: no decimal percent
// (so main's universal rate check stays out of it) and no banned phrase.
const NUMERIC_ONLY_VIOLATION = 'Most private lenders will go to 80% LTV on a file like yours.';
// A carve-out that must survive both blocks, on an alt_private lead.
const CARVE_OUT = 'Worth 15 minutes to see what is actually possible? The call is 100% free.';
// Trips BOTH main's banned-phrase block and the numeric approval-claim rule.
const DOUBLE_VIOLATION = 'This is basically guaranteed approval with your equity.';

process.env.HOLLY_ALT_LENDING_GUARDRAILS = 'on';

// FinanceVine lead: segment on the schema column.
check(
  'flag on + alt_private (segment column) => numeric violation blocked',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
      lead: leadFixture({ segment: 'alt_private', source: 'financevine' }),
      signals: {} as any,
    })
  ).length > 0
);

// leads_on_demand lead classified alt_private (bankability not_approved/unsure)
// is covered too — the whole point of keying on segment rather than source.
check(
  'flag on + leads_on_demand lead with segment alt_private => covered',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
      lead: leadFixture({
        segment: 'alt_private',
        source: 'leads_on_demand',
        rawData: { province: 'British Columbia', bank_status: 'not_approved' },
      }),
      signals: {} as any,
    })
  ).length > 0
);

// Segment carried only on rawData (pre-column ingest) still resolves.
check(
  'flag on + alt_private via rawData only => covered',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
      lead: leadFixture({ rawData: { province: 'British Columbia', segment: 'alt_private' } }),
      signals: {} as any,
    })
  ).length > 0
);

// prime_other is NOT covered — the conventional cohort is untouched.
check(
  'flag on + prime_other => NOT blocked by the numeric guardrail',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
      lead: leadFixture({ segment: 'prime_other', source: 'leads_on_demand' }),
      signals: {} as any,
    })
  ).length === 0
);

check(
  'flag on + prime_rate_shop => NOT blocked by the numeric guardrail',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
      lead: leadFixture({ segment: 'prime_rate_shop', source: 'rates_ca' }),
      signals: {} as any,
    })
  ).length === 0
);

check(
  'flag on + unclassified lead => NOT blocked by the numeric guardrail',
  numericErrors(
    validateDecision(sms(NUMERIC_ONLY_VIOLATION), { lead: leadFixture(), signals: {} as any })
  ).length === 0
);

// Carve-outs survive on an alt_private lead with the flag ON.
check(
  'flag on + alt_private + carve-out => no numeric error, no ban error',
  (() => {
    const v = validateDecision(sms(CARVE_OUT), {
      lead: leadFixture({ segment: 'alt_private' }),
      signals: {} as any,
    });
    return numericErrors(v).length === 0 && banErrors(v).length === 0;
  })()
);

// Interaction: a message tripping both blocks yields ONE block with both
// reasons — same errors array, same downstream handling, no contradiction.
check(
  'flag on + alt_private + double violation => one block carrying both reasons',
  (() => {
    const v = validateDecision(sms(DOUBLE_VIOLATION), {
      lead: leadFixture({ segment: 'alt_private' }),
      signals: {} as any,
    });
    return v.isValid === false && banErrors(v).length === 1 && numericErrors(v).length === 1;
  })()
);

// Every draft-copy fixture must also survive validateDecision() end-to-end on
// an alt_private lead with the flag on — carve-outs must clear BOTH blocks.
for (const { label, text } of DRAFT_COPY_FIXTURES) {
  const v = validateDecision(sms(text), {
    lead: leadFixture({ segment: 'alt_private' }),
    signals: {} as any,
  });
  check(
    `e2e CLEAN: draft ${label}`,
    numericErrors(v).length === 0 && banErrors(v).length === 0,
    [...numericErrors(v), ...banErrors(v)].join(' | ')
  );
}

// Flag OFF disables the numeric guardrail for EVERY segment, including
// alt_private. Main's banned-phrase block is unflagged and still fires.
delete process.env.HOLLY_ALT_LENDING_GUARDRAILS;

for (const segment of ['alt_private', 'prime_other', 'prime_rate_shop', null]) {
  check(
    `flag off + segment ${segment ?? '(none)'} => numeric guardrail inert`,
    numericErrors(
      validateDecision(sms(NUMERIC_ONLY_VIOLATION), {
        lead: leadFixture({ segment }),
        signals: {} as any,
      })
    ).length === 0
  );
}

check(
  'flag off + alt_private => main banned-phrase block STILL fires (unflagged)',
  banErrors(
    validateDecision(sms(DOUBLE_VIOLATION), {
      lead: leadFixture({ segment: 'alt_private' }),
      signals: {} as any,
    })
  ).length === 1
);

console.log(`\n${'='.repeat(60)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
