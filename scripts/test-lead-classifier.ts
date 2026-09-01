/**
 * Unit tests for the deterministic lead vertical classifier.
 *
 * Run: npx tsx scripts/test-lead-classifier.ts
 *
 * Covers: every classification rule; the reverse-mortgage path specifically;
 * the ambiguity rule defaulting to alt-lending on empty / partial /
 * contradictory input; NULL-vertical-reads-as-conventional; and that `reason`
 * is populated in every branch.
 */

import {
  classifyLead,
  readLeadVertical,
  SOURCE_VERTICAL_DEFAULTS,
  type ClassifierInput,
  type LeadVertical,
  type LeadProductType,
} from '../lib/holly/verticals/classify';

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

/** Every assertion also enforces that `reason` is non-empty. */
function expectClass(
  name: string,
  input: ClassifierInput,
  vertical: LeadVertical,
  productType?: LeadProductType,
) {
  const r = classifyLead(input);
  const vOk = r.vertical === vertical;
  const pOk = productType === undefined || r.productType === productType;
  const reasonOk = typeof r.reason === 'string' && r.reason.trim().length > 0;
  check(
    name,
    vOk && pOk && reasonOk,
    `got vertical=${r.vertical} productType=${r.productType} reason="${r.reason}"`,
  );
}

console.log('\n=== 1. REVERSE MORTGAGE PATH (drives the draft short-circuit from DATA) ===\n');

expectClass('reverse mortgage + age 68', { mortgageType: 'reverse mortgage', age: 68 }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('reverse mortgage + age exactly 55', { mortgageType: 'Reverse Mortgage', age: 55 }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('reverse mortgage + bracket "55+"', { mortgageType: 'reverse', ageBracket: '55+' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('reverse mortgage + bracket "65-74"', { mortgageType: 'reverse', ageBracket: '65-74' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('reverse mortgage, age absent', { mortgageType: 'reverse_mortgage' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
// Contradictory: reverse mortgages require 55+. Must NOT resolve to conventional.
expectClass('reverse mortgage + age 41 (contradictory)', { mortgageType: 'reverse mortgage', age: 41 }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
// Even an explicit bank-approvable answer must not pull a reverse lead out.
expectClass(
  'reverse mortgage + CAN_GET_APPROVED',
  { mortgageType: 'reverse mortgage', age: 70, bankApprovalStatus: 'CAN_GET_APPROVED' },
  'ALT_LENDING',
  'REVERSE_MORTGAGE',
);

console.log('\n=== 2. BORROWER-PROFILE RULE ===\n');

expectClass('cannot get approved', { bankApprovalStatus: 'CANNOT_GET_APPROVED' }, 'ALT_LENDING');
expectClass('unsure', { bankApprovalStatus: 'UNSURE' }, 'ALT_LENDING');
expectClass('equity take-out + cannot approve', { mortgageType: 'equity takeout', bankApprovalStatus: 'CANNOT_GET_APPROVED' }, 'ALT_LENDING', 'HOME_EQUITY');
expectClass('refinance + unsure', { mortgageType: 'refinance', bankApprovalStatus: 'UNSURE' }, 'ALT_LENDING', 'REFINANCE');
expectClass('renewal + cannot approve', { mortgageType: 'renewal', bankApprovalStatus: 'CANNOT_GET_APPROVED' }, 'ALT_LENDING', 'RENEWAL');
expectClass('HELOC normalizes to HOME_EQUITY', { mortgageType: 'HELOC', bankApprovalStatus: 'UNSURE' }, 'ALT_LENDING', 'HOME_EQUITY');

console.log('\n=== 3. CONVENTIONAL — requires POSITIVE evidence on both axes ===\n');

expectClass('approvable + purchase + rate shopping', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'purchase', rateShopping: true }, 'CONVENTIONAL', 'PURCHASE');
expectClass('approvable + refinance', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'refinance' }, 'CONVENTIONAL', 'REFINANCE');
expectClass('approvable + renewal', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'renewal' }, 'CONVENTIONAL', 'RENEWAL');
// "bank-approvable" ALONE is not enough — absence of a product signal is not
// evidence of conventionality.
expectClass('approvable but UNKNOWN product -> alt-lending', { bankApprovalStatus: 'CAN_GET_APPROVED' }, 'ALT_LENDING', 'UNKNOWN');

console.log('\n=== 4. AMBIGUITY RULE — must fail to ALT_LENDING ===\n');

expectClass('completely empty input', {}, 'ALT_LENDING', 'UNKNOWN');
expectClass('all fields explicitly null', { source: null, bankApprovalStatus: null, mortgageType: null, age: null, ageBracket: null, rateShopping: null, province: null }, 'ALT_LENDING', 'UNKNOWN');
expectClass('partial: province only', { province: 'British Columbia' }, 'ALT_LENDING', 'UNKNOWN');
expectClass('partial: product only, no approval answer', { mortgageType: 'refinance' }, 'ALT_LENDING', 'REFINANCE');
expectClass('partial: rate-shopping only', { rateShopping: true }, 'ALT_LENDING', 'UNKNOWN');
expectClass('unregistered source, no signals', { source: 'some-new-vendor' }, 'ALT_LENDING', 'UNKNOWN');
expectClass('contradictory: cannot approve + rate shopping', { bankApprovalStatus: 'CANNOT_GET_APPROVED', rateShopping: true }, 'ALT_LENDING');
expectClass('garbage product string', { mortgageType: '???' }, 'ALT_LENDING', 'UNKNOWN');

// The contradiction must be recorded in the reason, not silently smoothed over.
const conflicted = classifyLead({ bankApprovalStatus: 'CANNOT_GET_APPROVED', rateShopping: true });
check('contradiction is named in `reason`', /contradictor/i.test(conflicted.reason), `reason="${conflicted.reason}"`);

console.log('\n=== 5. SOURCE-LEVEL FALLBACK (refined by per-lead rules, never hardcoding) ===\n');

expectClass('financevine, no other signals', { source: 'financevine' }, 'ALT_LENDING', 'UNKNOWN');
expectClass('financevine, case-insensitive', { source: 'FinanceVine' }, 'ALT_LENDING', 'UNKNOWN');
expectClass('financevine with whitespace', { source: '  financevine  ' }, 'ALT_LENDING', 'UNKNOWN');
// Per-lead signals REFINE the source default. A registered alt-lending source
// whose lead claims bank-approvability is CONTRADICTORY (FinanceVine's own
// qualification filter excludes approvable borrowers), so it resolves
// restrictive rather than to conventional.
expectClass(
  'financevine + CAN_GET_APPROVED is contradictory -> alt-lending',
  { source: 'financevine', bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'purchase', rateShopping: true },
  'ALT_LENDING',
  'PURCHASE',
);
// ...but the source default does NOT hardcode: an unregistered source with
// clean conventional signals still classifies conventional.
expectClass(
  'unregistered source + conventional signals -> CONVENTIONAL',
  { source: 'some-new-vendor', bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'purchase', rateShopping: true },
  'CONVENTIONAL',
  'PURCHASE',
);
// ...and a per-lead rule, not the source default, supplies the reason when both agree.
const fvUnsure = classifyLead({ source: 'financevine', bankApprovalStatus: 'UNSURE', mortgageType: 'refinance' });
check('per-lead rule wins the reason over source default', /UNSURE/.test(fvUnsure.reason) && !/source default/.test(fvUnsure.reason), `reason="${fvUnsure.reason}"`);
check('rates.ca is NOT registered (no source-specific logic yet)', !('rates.ca' in SOURCE_VERTICAL_DEFAULTS) && !('ratesca' in SOURCE_VERTICAL_DEFAULTS));
check('only financevine is registered so far', Object.keys(SOURCE_VERTICAL_DEFAULTS).length === 1);

console.log('\n=== 5b. REGRESSIONS FROM ADVERSARIAL REVIEW ===\n');

// (A) Reverse-mortgage vocabulary that contains "equity" and not "reverse".
// Each previously bucketed as HOME_EQUITY and, with CAN_GET_APPROVED, fell
// through to CONVENTIONAL — dropping a 55+ reverse lead out of the guardrail.
const approvable72 = { bankApprovalStatus: 'CAN_GET_APPROVED' as const, age: 72 };
expectClass('HECM full name', { ...approvable72, mortgageType: 'Home Equity Conversion Mortgage' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('HECM acronym', { ...approvable72, mortgageType: 'HECM' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('Equity Release', { ...approvable72, mortgageType: 'Equity Release' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('Senior Equity Release', { ...approvable72, mortgageType: 'Senior Equity Release' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('CHIP', { ...approvable72, mortgageType: 'CHIP Reverse Mortgage' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('retirement income mortgage', { ...approvable72, mortgageType: 'Retirement Income Mortgage' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');

// (B) Age-bracket parsing must not record false facts in `reason`.
const under55 = classifyLead({ mortgageType: 'reverse', ageBracket: 'under 55' });
check('"under 55" not reported as confirmed 55+', !/confirmed 55\+/.test(under55.reason), `reason="${under55.reason}"`);
const hundredPlus = classifyLead({ mortgageType: 'reverse', ageBracket: '100+' });
check('"100+" not read as under 55', !/under 55/.test(hundredPlus.reason), `reason="${hundredPlus.reason}"`);
expectClass('bracket "under 55" still alt-lending', { mortgageType: 'reverse', ageBracket: 'under 55' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');
expectClass('bracket "100+" still alt-lending', { mortgageType: 'reverse', ageBracket: '100+' }, 'ALT_LENDING', 'REVERSE_MORTGAGE');

// (C) Product-string mis-bucketing.
expectClass('spousal buyout is a refinance, not a purchase', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'Spousal Buyout' }, 'CONVENTIONAL', 'REFINANCE');

// (D) A bank-approvable claim must not override an alt-lending product string.
expectClass('B-lender refinance', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'B-lender refinance' }, 'ALT_LENDING', 'REFINANCE');
expectClass('private second mortgage', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'Private Second Mortgage' }, 'ALT_LENDING', 'HOME_EQUITY');
expectClass('MIC lending', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'MIC second' }, 'ALT_LENDING', 'HOME_EQUITY');
expectClass('alt lender purchase', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'Alternative Lender Purchase' }, 'ALT_LENDING', 'PURCHASE');
expectClass('alt product without approval answer', { mortgageType: 'private second mortgage' }, 'ALT_LENDING', 'HOME_EQUITY');

console.log('\n=== 6. READ SIDE — NULL vertical reads as CONVENTIONAL ===\n');

check('NULL vertical -> CONVENTIONAL', readLeadVertical({ source: 'leads_on_demand', vertical: null }) === 'CONVENTIONAL');
check('undefined vertical -> CONVENTIONAL', readLeadVertical({ source: null }) === 'CONVENTIONAL');
check('empty-string vertical -> CONVENTIONAL', readLeadVertical({ source: null, vertical: '' }) === 'CONVENTIONAL');
check('unrecognized value -> CONVENTIONAL', readLeadVertical({ source: null, vertical: 'nonsense' }) === 'CONVENTIONAL');
check('ALT_LENDING round-trips', readLeadVertical({ source: 'financevine', vertical: 'ALT_LENDING' }) === 'ALT_LENDING');
check('alt_lending lowercase round-trips', readLeadVertical({ source: 'financevine', vertical: 'alt_lending' }) === 'ALT_LENDING');
check('CONVENTIONAL round-trips', readLeadVertical({ source: null, vertical: 'CONVENTIONAL' }) === 'CONVENTIONAL');

console.log('\n=== 7. `reason` POPULATED IN EVERY BRANCH ===\n');

const allInputs: Array<[string, ClassifierInput]> = [
  ['reverse 55+', { mortgageType: 'reverse', age: 70 }],
  ['reverse under 55', { mortgageType: 'reverse', age: 40 }],
  ['reverse no age', { mortgageType: 'reverse' }],
  ['cannot approve', { bankApprovalStatus: 'CANNOT_GET_APPROVED' }],
  ['unsure', { bankApprovalStatus: 'UNSURE' }],
  ['contradictory', { bankApprovalStatus: 'CANNOT_GET_APPROVED', rateShopping: true }],
  ['conventional', { bankApprovalStatus: 'CAN_GET_APPROVED', mortgageType: 'purchase' }],
  ['source default', { source: 'financevine' }],
  ['empty', {}],
];
for (const [label, input] of allInputs) {
  const r = classifyLead(input);
  check(`reason non-empty: ${label}`, typeof r.reason === 'string' && r.reason.trim().length > 10, `reason="${r.reason}"`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
