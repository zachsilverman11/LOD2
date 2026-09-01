/**
 * Unit tests for the alt-lending runtime guardrail (Hard Guardrail #8, numeric half).
 *
 * Run: npx tsx scripts/test-alt-lending-guardrails.ts
 *
 * Covers three things:
 *  1. Violations ARE caught by checkAltLendingNumericCompliance().
 *  2. Deliberate carve-outs are NOT caught — including every message string
 *     currently living in the alt-lending draft module, which must pass clean.
 *  3. The enforcement is genuinely default-off and double-gated, and
 *     conventional-cohort behaviour is unchanged.
 */

import {
  checkAltLendingNumericCompliance,
  isAltLendingNumericGuardrailEnabled,
  isAltLendingVertical,
} from '../lib/holly/guardrails';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The draft module is deliberately NOT imported — it must stay unimported
 * repo-wide so it compiles into nothing. Instead we read its source and pull
 * out the literal message strings, so this test still exercises the module's
 * ACTUAL current copy and catches drift, without creating an import edge.
 */
function extractDraftMessages(): Array<{ label: string; text: string }> {
  const src = readFileSync(
    join(__dirname, '..', 'lib', 'holly', 'verticals', 'alt-lending.draft.ts'),
    'utf-8'
  );
  const out: Array<{ label: string; text: string }> = [];
  const pattern =
    /\b(hookMessage|followUpNudge|message):\s*\n?\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(src)) !== null) {
    const raw = m[2];
    const body = raw.slice(1, -1).replace(/\\(['"\\])/g, '$1');
    out.push({ label: `${m[1]} #${++i}`, text: body });
  }
  return out;
}

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

console.log('\n=== 2b. EVERY DRAFT-MODULE MESSAGE MUST PASS CLEAN ===\n');

const draftMessages = extractDraftMessages();
check(
  'extracted a plausible number of draft messages (>= 16)',
  draftMessages.length >= 16,
  `only found ${draftMessages.length} — the extraction regex may have drifted`
);
for (const { label, text } of draftMessages) {
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

// Second gate: vertical must be alt-lending.
check('no vertical anywhere => not alt-lending', isAltLendingVertical({ lead: {} }) === false);
check('conventional rawData => not alt-lending', isAltLendingVertical({ lead: { rawData: { province: 'British Columbia' } } }) === false);
check('undefined lead => not alt-lending', isAltLendingVertical({}) === false);
check('context vertical ALT_LENDING => alt-lending', isAltLendingVertical({ vertical: 'ALT_LENDING', lead: {} }) === true);
check('rawData vertical alt_lending (case-insensitive) => alt-lending', isAltLendingVertical({ lead: { rawData: { vertical: 'alt_lending' } } }) === true);
check('rawData vertical CONVENTIONAL => not alt-lending', isAltLendingVertical({ lead: { rawData: { vertical: 'CONVENTIONAL' } } }) === false);

console.log(`\n${'='.repeat(60)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
