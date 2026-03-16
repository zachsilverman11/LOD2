/**
 * Comprehensive test suite for LOD Phase 1-3 build
 * Tests: HTML generation, copy fidelity, Holly hooks, email/SMS templates
 * Run: npx tsx scripts/test-full-build.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";
import { REPORT_COPY } from "../lib/report-copy";
import { selectBookingHook } from "../lib/holly/brain";
import {
  buildReportDeliveryEmail,
  buildDay3FollowUpEmail,
  buildDay7FollowUpEmail,
  type PostCallEmailParams,
} from "../lib/email-templates/post-call-sequence";
import {
  buildReportNotificationSms,
  buildDay2FollowUpSms,
  buildDay5UrgencySms,
  buildDay10FinalSms,
  type PostCallSmsParams,
} from "../lib/sms-templates/post-call-sequence";
import { replaceVariables, buildVariableMap } from "../lib/report-helpers";

const OUTPUT_DIR = join(process.cwd(), "test-output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================================================
// TEST DATA
// ============================================================================
const consultant = {
  name: "Greg Williamson",
  email: "greg@inspired.mortgage",
  phone: "(416) 555-0123",
  calLink: "cal.com/inspired-mortgage/greg",
};

const baseProps: Omit<ReportHTMLProps, "scenario" | "includeDebtConsolidation" | "includeCashBack" | "extractedData"> = {
  clientName: "Sarah Mitchell",
  date: "January 29, 2026",
  consultant,
  bullets: [
    "You're coming up for renewal on your $485,000 mortgage with TD Bank",
    "Your current rate of 1.89% has served you well",
    "You mentioned wanting to keep your monthly payments manageable",
    "You have a car loan ($32,000) and line of credit ($18,500)",
    "Your goal is to be mortgage-free before retirement in 15 years",
  ],
  mortgageAmount: "$485,000",
  applicationLink: "https://stressfree.mtg-app.com/signup",
};

// ============================================================================
// TEST 1: HTML GENERATION — All Scenario Combinations
// ============================================================================
async function testHTMLGeneration() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 1: HTML Report Generation");
  console.log("══════════════════════════════════════════\n");

  const scenarios: Array<{
    name: string;
    scenario: 0 | 1 | 2 | 3;
    debtConsol: boolean;
    cashBack: boolean;
    extractedData: any;
  }> = [
    {
      name: "scenario-1-debt-no-cashback",
      scenario: 1,
      debtConsol: true,
      cashBack: false,
      extractedData: {
        mortgageAmount: 485000,
        originalAmortization: 25,
        currentAmortization: 20,
        previousRate: 0.0189,
        currentMarketRate: 0.0449,
        oldPayment: 2045,
        newPayment: 2689,
        paymentDifference: 644,
        fiveYearsOfPayments: 161340,
        otherDebts: [
          { type: "Car loan", balance: 32000, payment: 625 },
          { type: "Line of credit", balance: 18500, payment: 285 },
        ],
      },
    },
    {
      name: "scenario-1-debt-cashback",
      scenario: 1,
      debtConsol: true,
      cashBack: true,
      extractedData: {
        mortgageAmount: 485000,
        originalAmortization: 25,
        currentAmortization: 20,
        previousRate: 0.0189,
        currentMarketRate: 0.0449,
        oldPayment: 2045,
        newPayment: 2689,
        paymentDifference: 644,
        fiveYearsOfPayments: 161340,
        otherDebts: [
          { type: "Car loan", balance: 32000, payment: 625 },
          { type: "Line of credit", balance: 18500, payment: 285 },
        ],
      },
    },
    {
      name: "scenario-2-no-debt-no-cashback",
      scenario: 2,
      debtConsol: false,
      cashBack: false,
      extractedData: {
        mortgageAmount: 520000,
        originalAmortization: 25,
        currentAmortization: 22,
        originalRate: 0.0145,
        lockInRate: 0.0579,
        estimatedExtraInterest: 38675,
      },
    },
    {
      name: "scenario-3-no-debt-cashback",
      scenario: 3,
      debtConsol: false,
      cashBack: true,
      extractedData: {
        mortgageAmount: 415000,
        originalAmortization: 25,
        currentAmortization: 26,
        originalRate: 0.0165,
        fixedPayment: 1850,
      },
    },
    {
      name: "no-scenario-cashback",
      scenario: 0,
      debtConsol: false,
      cashBack: true,
      extractedData: {
        mortgageAmount: 485000,
      },
    },
    {
      name: "no-scenario-no-cashback",
      scenario: 0,
      debtConsol: false,
      cashBack: false,
      extractedData: {
        mortgageAmount: 485000,
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    try {
      const props: ReportHTMLProps = {
        ...baseProps,
        scenario: s.scenario === 0 ? null : s.scenario as 1 | 2 | 3,
        includeDebtConsolidation: s.debtConsol,
        includeCashBack: s.cashBack,
        extractedData: s.extractedData,
      };

      const html = generateReportHTML(props);
      const path = join(OUTPUT_DIR, `report-${s.name}.html`);
      writeFileSync(path, html, "utf-8");

      // Basic validation
      const checks = [
        { name: "Has cover page", test: html.includes("SEE LENDERS COMPETE FOR YOUR BUSINESS") || html.includes("See Lenders Compete") },
        { name: "Has client name", test: html.includes("Sarah Mitchell") },
        { name: "Has consultant", test: html.includes("Greg Williamson") },
        { name: "Has What You Told Us", test: html.includes("What You Told Us") },
        { name: "Has Our Approach", test: html.includes("Our Approach") },
        { name: "Has $5,000 Guarantee", test: html.includes("$5,000 Penalty Guarantee") || html.includes("Penalty Guarantee") },
        { name: "Has Fixed Rate Strategy", test: html.includes("Fixed Rate Mortgage") },
        { name: "Has Variable Rate Strategy", test: html.includes("Variable Rate Mortgage") },
        { name: "Has What Happens Next", test: html.includes("What Happens Next") },
        { name: "Has application link", test: html.includes("stressfree.mtg-app.com/signup") },
        { name: "50/50 split (not old copy)", test: html.includes("50/50") },
        { name: "Ask Your Bank (correct)", test: html.includes("will you guarantee that I will not pay any higher") },
        { name: "Monthly Monitoring", test: html.includes("Monthly Mortgage Monitoring") },
        { name: "Strategic Relock", test: html.includes("Strategic Relock") },
        { name: "Borrower A vs B", test: html.includes("Borrower A") || html.includes("BORROWER A") },
        { name: "Danger of Going It Alone", test: html.includes("Danger of Going It Alone") },
      ];

      // Conditional checks
      if (s.scenario === 1) {
        checks.push({ name: "Scenario 1 heading", test: html.includes("What Happened on Your Last Term") });
        checks.push({ name: "Active Management", test: html.includes("Active Management") });
      }
      if (s.scenario === 2) {
        checks.push({ name: "Scenario 2 content", test: html.includes("Panic Lock") || html.includes("panic") || html.includes("locked in") });
      }
      if (s.scenario === 3) {
        checks.push({ name: "Scenario 3 negative am", test: html.includes("negative amortization") || html.includes("Negative Amortization") });
      }
      if (s.cashBack) {
        checks.push({ name: "Cash Back section present", test: html.includes("Cash Back Mortgage") });
        checks.push({ name: "Cash Back true story", test: html.includes("Escaping the Credit Card Trap") });
      }
      if (s.debtConsol) {
        checks.push({ name: "Debt Consolidation present", test: html.includes("Opportunity You Might Not See") || html.includes("Debt Consolidation") || html.includes("debt consolidation") });
      }
      if (s.scenario === 0) {
        checks.push({ name: "No scenario section", test: !html.includes("What Happened on Your Last Term") });
      }

      let allPassed = true;
      for (const check of checks) {
        if (!check.test) {
          console.log(`  ❌ ${s.name}: FAILED — ${check.name}`);
          allPassed = false;
          failed++;
        }
      }

      if (allPassed) {
        console.log(`  ✅ ${s.name} — ${checks.length} checks passed → ${path}`);
        passed += checks.length;
      } else {
        passed += checks.filter(c => c.test).length;
      }
    } catch (error) {
      console.log(`  ❌ ${s.name}: EXCEPTION — ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ============================================================================
// TEST 2: COPY FIDELITY — Verify approved copy renders verbatim
// ============================================================================
function testCopyFidelity() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 2: Copy Fidelity Verification");
  console.log("══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  // Generate a full report with Scenario 1 + Cash Back + Debt Consolidation
  const html = generateReportHTML({
    ...baseProps,
    scenario: 1,
    includeDebtConsolidation: true,
    includeCashBack: true,
    extractedData: {
      mortgageAmount: 485000,
      originalAmortization: 25,
      currentAmortization: 20,
      previousRate: 0.0189,
      oldPayment: 2045,
      newPayment: 2689,
      paymentDifference: 644,
      fiveYearsOfPayments: 161340,
      otherDebts: [
        { type: "Car loan", balance: 32000, payment: 625 },
        { type: "Line of credit", balance: 18500, payment: 285 },
      ],
    },
  });

  // Critical copy phrases that MUST appear verbatim
  const criticalPhrases = [
    // Cover
    "SEE LENDERS COMPETE FOR YOUR BUSINESS",
    "This report takes about 10 minutes to read",
    "Markets change. So should your mortgage strategy.",

    // $5K Guarantee — THE critical fix
    "we split it 50/50",
    "will you guarantee that I will not pay any higher of a penalty than $5,000",
    "for any reason I break the mortgage, including selling my house",
    "the risk of renewing with them is way too high",

    // Fixed Rate — was severely watered down
    "Monthly Mortgage Monitoring",
    "Strategic Relock",
    "BORROWER A",
    "BORROWER B",
    "If rates drop significantly during my term, will you call me",

    // Variable Rate — was thin
    "Danger of Going It Alone",
    "tens of thousands in extra interest, years added to their mortgage",
    "$5,000 Mortgage Penalty Guarantee",

    // Cash Back
    "Escaping the Credit Card Trap",
    "drowning in credit card debt",
    "Three cards. $22,000 total",

    // Debt Consolidation
    "Same monthly cash flow. Half the time. Completely debt-free a decade sooner.",

    // Our Approach
    "90 years combined experience",
    "We work for you, not the banks",

    // What Happens Next
    "No pressure. No obligation. Just clear information",
  ];

  for (const phrase of criticalPhrases) {
    if (html.includes(phrase)) {
      passed++;
    } else {
      console.log(`  ❌ MISSING: "${phrase.substring(0, 60)}..."`);
      failed++;
    }
  }

  console.log(`\n  Copy fidelity: ${passed}/${passed + failed} critical phrases found`);
  if (failed === 0) {
    console.log("  ✅ ALL critical copy renders verbatim");
  } else {
    console.log(`  ❌ ${failed} phrases MISSING — Greg's copy may have been paraphrased`);
  }

  return failed === 0;
}

// ============================================================================
// TEST 3: HOLLY BOOKING HOOKS — Keyword detection
// ============================================================================
function testHollyHooks() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 3: Holly Booking Hook Selection");
  console.log("══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  const testCases = [
    // Renewal signals
    { text: "My renewal is coming up next month", expectedHook: "before-your-bank", label: "renewal keyword" },
    { text: "I got a bank letter about my term ending", expectedHook: "before-your-bank", label: "term ending" },
    { text: "Looking to renew my mortgage", expectedHook: "before-your-bank", label: "renew" },

    // Rate shopping signals
    { text: "I'm comparing rates from different lenders", expectedHook: "what-they-dont-tell-you", label: "comparing rates" },
    { text: "What's your best rate?", expectedHook: "what-they-dont-tell-you", label: "best rate" },
    { text: "I want the lowest rate possible", expectedHook: "what-they-dont-tell-you", label: "lowest rate" },

    // Partner signals
    { text: "I need to talk to my wife about this", expectedHook: "spouse-needs-to-see", label: "wife mention" },
    { text: "My husband and I are looking at options", expectedHook: "spouse-needs-to-see", label: "husband mention" },
    { text: "My partner and I want to discuss", expectedHook: "spouse-needs-to-see", label: "partner mention" },

    // Skeptical signals
    { text: "This sounds too good to be true", expectedHook: "too-good-to-be-true", label: "too good" },
    { text: "What's the catch here?", expectedHook: "too-good-to-be-true", label: "what's the catch" },
    { text: "This feels like a sales pitch", expectedHook: "too-good-to-be-true", label: "sales pitch" },

    // Default (no signals)
    { text: "I'm interested in getting a mortgage", expectedHook: "hidden-cost", label: "default/general" },
    { text: "Tell me about your services", expectedHook: "hidden-cost", label: "generic inquiry" },
  ];

  for (const tc of testCases) {
    try {
      const hook = selectBookingHook(tc.text);
      if (hook.id === tc.expectedHook) {
        passed++;
      } else {
        console.log(`  ❌ "${tc.label}": expected ${tc.expectedHook}, got ${hook.id}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ "${tc.label}": EXCEPTION — ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n  Hook selection: ${passed}/${passed + failed} correct`);
  if (failed === 0) {
    console.log("  ✅ ALL hooks select correctly");
  }

  return failed === 0;
}

// ============================================================================
// TEST 4: EMAIL TEMPLATES — Rendering
// ============================================================================
function testEmailTemplates() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 4: Email Template Rendering");
  console.log("══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  const emailParams: PostCallEmailParams = {
    clientFirstName: "Sarah",
    advisorName: "Greg Williamson",
    advisorEmail: "greg@inspired.mortgage",
    advisorPhone: "(416) 555-0123",
  };

  const emailBuilders = [
    { id: "report-delivery", fn: buildReportDeliveryEmail },
    { id: "day-3-followup", fn: buildDay3FollowUpEmail },
    { id: "day-7-followup", fn: buildDay7FollowUpEmail },
  ];

  for (const { id, fn } of emailBuilders) {
    try {
      const rendered = fn(emailParams);

      // Check subject rendered
      if (!rendered.subject || rendered.subject.includes("{{")) {
        console.log(`  ❌ Email ${id}: subject has unresolved variables`);
        failed++;
      } else {
        passed++;
      }

      // Check body rendered
      if (!rendered.html || rendered.html.includes("{{")) {
        console.log(`  ❌ Email ${id}: body has unresolved variables`);
        failed++;
      } else {
        passed++;
      }

      // Check application link present
      if (rendered.html.includes("stressfree.mtg-app.com")) {
        passed++;
      } else {
        console.log(`  ❌ Email ${id}: missing application link`);
        failed++;
      }

      // Save HTML for visual review
      const path = join(OUTPUT_DIR, `email-${id}.html`);
      writeFileSync(path, rendered.html, "utf-8");
      console.log(`  ✅ Email ${id}: "${rendered.subject}" → ${path}`);
    } catch (error) {
      console.log(`  ❌ Email ${id}: EXCEPTION — ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n  Emails: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// ============================================================================
// TEST 5: SMS TEMPLATES — Rendering
// ============================================================================
function testSmsTemplates() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 5: SMS Template Rendering");
  console.log("══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  const smsParams: PostCallSmsParams = {
    clientFirstName: "Sarah",
    advisorName: "Greg",
  };

  const smsBuilders = [
    { id: "report-notification", day: 0, fn: buildReportNotificationSms },
    { id: "day-2-followup", day: 2, fn: buildDay2FollowUpSms },
    { id: "day-5-urgency", day: 5, fn: buildDay5UrgencySms },
    { id: "day-10-final", day: 10, fn: buildDay10FinalSms },
  ];

  for (const { id, day, fn } of smsBuilders) {
    try {
      const rendered = fn(smsParams);

      // Check no unresolved variables
      if (rendered.includes("{{")) {
        console.log(`  ❌ SMS ${id}: has unresolved variables`);
        failed++;
      } else {
        passed++;
      }

      // Check has app link
      if (rendered.includes("stressfree.mtg-app.com")) {
        passed++;
      } else {
        console.log(`  ❌ SMS ${id}: missing application link`);
        failed++;
      }

      // Check character count (SMS should be reasonable length)
      const charCount = rendered.length;
      if (charCount > 1600) {
        console.log(`  ⚠️  SMS ${id}: ${charCount} chars (may need multiple segments)`);
      }

      console.log(`  ✅ SMS ${id} (Day ${day}): ${charCount} chars`);
      const path = join(OUTPUT_DIR, `sms-${id}.txt`);
      writeFileSync(path, rendered, "utf-8");
    } catch (error) {
      console.log(`  ❌ SMS ${id}: EXCEPTION — ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n  SMS: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// ============================================================================
// TEST 6: Variable Replacement — No unreplaced {{placeholders}}
// ============================================================================
function testVariableReplacement() {
  console.log("\n══════════════════════════════════════════");
  console.log("TEST 6: Variable Replacement (No Raw Placeholders)");
  console.log("══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  // Generate full report with all sections
  const html = generateReportHTML({
    ...baseProps,
    scenario: 1,
    includeDebtConsolidation: true,
    includeCashBack: true,
    extractedData: {
      mortgageAmount: 485000,
      originalAmortization: 25,
      currentAmortization: 20,
      previousRate: 0.0189,
      oldPayment: 2045,
      newPayment: 2689,
      paymentDifference: 644,
      fiveYearsOfPayments: 161340,
      otherDebts: [
        { type: "Car loan", balance: 32000, payment: 625 },
        { type: "Line of credit", balance: 18500, payment: 285 },
      ],
    },
  });

  // Find any remaining {{VARIABLE}} placeholders
  const unreplaced = html.match(/\{\{[A-Z_]+\}\}/g);
  if (unreplaced && unreplaced.length > 0) {
    const unique = [...new Set(unreplaced)];
    console.log(`  ❌ Found ${unique.length} unreplaced variables:`);
    unique.forEach(v => console.log(`      ${v}`));
    failed += unique.length;
  } else {
    console.log("  ✅ No unreplaced {{VARIABLES}} found in rendered HTML");
    passed++;
  }

  // Also check for AI bullet placeholder
  if (html.includes("AI_GENERATED_BULLET_POINTS")) {
    console.log("  ❌ AI bullet placeholder still present");
    failed++;
  } else {
    passed++;
  }

  console.log(`\n  Variables: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  LOD Full Build Test Suite               ║");
  console.log("║  Phases 1-3 Verification                 ║");
  console.log("╚══════════════════════════════════════════╝");

  const results: Array<{ name: string; passed: boolean }> = [];

  results.push({ name: "HTML Generation", passed: await testHTMLGeneration() });
  results.push({ name: "Copy Fidelity", passed: testCopyFidelity() });
  results.push({ name: "Holly Hooks", passed: testHollyHooks() });
  results.push({ name: "Email Templates", passed: testEmailTemplates() });
  results.push({ name: "SMS Templates", passed: testSmsTemplates() });
  results.push({ name: "Variable Replacement", passed: testVariableReplacement() });

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  FINAL RESULTS                           ║");
  console.log("╠══════════════════════════════════════════╣");
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`║  ${status}  ${r.name.padEnd(30)}║`);
  }
  console.log("╚══════════════════════════════════════════╝");

  const allPassed = results.every(r => r.passed);
  console.log(`\nOutput files in: ${OUTPUT_DIR}`);
  console.log(allPassed ? "\n🎉 ALL TESTS PASSED\n" : "\n⚠️  SOME TESTS FAILED — review above\n");

  process.exit(allPassed ? 0 : 1);
}

main();
