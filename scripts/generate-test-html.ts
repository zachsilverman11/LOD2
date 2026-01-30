/**
 * Generate all test scenario HTML reports for visual review
 * No Puppeteer needed — just raw HTML files to open in browser
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";

const OUTPUT_DIR = join(process.cwd(), "test-output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const consultant = {
  name: "Greg Williamson",
  email: "greg@inspired.mortgage",
  phone: "(403) 555-1234", // Should NOT appear in output
  calLink: "cal.com/inspired-mortgage/greg",
};

const scenarios: Array<{ name: string; props: ReportHTMLProps }> = [
  // Scenario 1 + Debt + Cash Back — the full kitchen sink
  // Tests: cover footer, phone removal, debt table bold fix, verification box amortization, white space
  {
    name: "scenario-1-debt-cashback",
    props: {
      clientName: "Sarah Mitchell",
      date: "January 30, 2026",
      consultant,
      bullets: [
        "You currently have a $485,000 mortgage with TD Bank at 1.89% that's coming up for renewal",
        "Your original amortization was 25 years, now at 20 years remaining",
        "Your current payment is approximately $2,050/month",
        "At today's rates (around 4.49%), your payment would jump to approximately $2,680/month",
        "You also have a car loan and home renovation loan totaling $121,000",
      ],
      mortgageAmount: "$485,000",
      scenario: 1,
      includeDebtConsolidation: true,
      includeCashBack: true,
      applicationLink: "https://stressfree.mtg-app.com/signup",
      extractedData: {
        mortgageAmount: 485000,
        originalAmortization: 25,
        currentAmortization: 20,
        previousRate: 0.0189,
        currentMarketRate: 0.0449,
        oldPayment: 2050,
        newPayment: 2680,
        paymentDifference: 630,
        fiveYearsOfPayments: 160800,
        otherDebts: [
          { type: "Car loan", balance: 75000, payment: 1555 },
          { type: "Home renovation loan", balance: 46000, payment: 450 },
        ],
      },
    },
  },
  // Scenario 2 only — tests cover page, CTA page
  {
    name: "scenario-2-only",
    props: {
      clientName: "David Chen",
      date: "January 30, 2026",
      consultant,
      bullets: [
        "You currently have a $520,000 mortgage with Royal Bank locked in at 5.79%",
        "You originally started with a variable rate at prime minus 0.85%",
        "You locked in during the 2022-2023 rate climb",
        "Your renewal isn't for another 2.5 years",
      ],
      mortgageAmount: "$520,000",
      scenario: 2,
      includeDebtConsolidation: false,
      includeCashBack: false,
      applicationLink: "https://stressfree.mtg-app.com/signup",
      extractedData: {
        mortgageAmount: 520000,
        originalAmortization: 25,
        currentAmortization: 22,
        originalRate: 0.0145,
        lockInRate: 0.0579,
        estimatedExtraInterest: 38675,
      },
    },
  },
  // No scenario + Cash Back — tests cash back section + CTA
  {
    name: "no-scenario-cashback",
    props: {
      clientName: "Emily Park",
      date: "January 30, 2026",
      consultant,
      bullets: [
        "You're a first-time buyer looking at homes around $600,000",
        "You have $120,000 saved for a down payment",
        "You're carrying $22,000 in credit card debt across three cards",
        "You want to understand all options including cash back",
      ],
      mortgageAmount: "$480,000",
      scenario: null,
      includeDebtConsolidation: false,
      includeCashBack: true,
      applicationLink: "https://stressfree.mtg-app.com/signup",
      extractedData: {
        mortgageAmount: 480000,
      },
    },
  },
];

function main() {
  for (const s of scenarios) {
    console.log(`Generating ${s.name}...`);
    const html = generateReportHTML(s.props);
    const htmlPath = join(OUTPUT_DIR, `review-${s.name}.html`);
    writeFileSync(htmlPath, html);
    console.log(`  → ${htmlPath}`);
  }
  console.log("\nDone! Open files in browser to review.");
}

main();
