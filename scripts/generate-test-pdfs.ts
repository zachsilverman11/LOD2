/**
 * Test script to generate sample PDFs for all 3 scenarios
 * Run with: npx tsx scripts/generate-test-pdfs.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";

// Output directory
const OUTPUT_DIR = join(process.cwd(), "test-pdfs");

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Sample data for all scenarios
const clientName = "Sarah Mitchell";
const date = "January 16, 2026";
const consultant = {
  name: "Greg Williamson",
  email: "greg@inspired.mortgage",
  phone: "(416) 555-0123",
  calLink: "cal.com/inspired-mortgage/greg",
};

// Application link for testing
const applicationLink = "https://www.inspired.mortgage/start-here";

// Scenario 1: Sub-2% Fixed → Renewal Trap (WITH debt consolidation)
const scenario1Props: ReportHTMLProps = {
  clientName,
  date,
  consultant,
  bullets: [
    "You're coming up for renewal on your $485,000 mortgage with TD Bank",
    "Your current rate of 1.89% has served you well, but you're concerned about payment shock at renewal",
    "You mentioned wanting to keep your monthly payments manageable while not extending your timeline",
    "You have a car loan ($32,000) and line of credit ($18,500) you'd like to potentially consolidate",
    "Your goal is to be mortgage-free before retirement in 15 years",
    "You're open to exploring both fixed and variable rate options for this next term",
    "You mentioned your household income has increased since you first got the mortgage",
  ],
  mortgageAmount: "$485,000",
  scenario: 1,
  includeDebtConsolidation: true,
  applicationLink,
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
};

// Scenario 2: Variable → Panic Lock (WITHOUT debt consolidation)
const scenario2Props: ReportHTMLProps = {
  clientName,
  date,
  consultant,
  bullets: [
    "You currently have a $520,000 mortgage with Royal Bank that you locked in at 5.79%",
    "You originally started with a variable rate at prime minus 0.85% (around 1.45%)",
    "When rates started climbing in 2022, you panicked and locked into a 5-year fixed",
    "You've been watching rates drop and feel frustrated that you're stuck at the higher rate",
    "You're wondering if there's any way to get out of this mortgage without a huge penalty",
    "Your renewal isn't for another 2.5 years, but you want to understand your options",
    "You're committed to staying in your home long-term and prioritize stability",
  ],
  mortgageAmount: "$520,000",
  scenario: 2,
  includeDebtConsolidation: false,
  applicationLink,
  extractedData: {
    mortgageAmount: 520000,
    originalAmortization: 25,
    currentAmortization: 22,
    originalRate: 0.0145,
    lockInRate: 0.0579,
    estimatedExtraInterest: 38675,
  },
};

// Scenario 3: Fixed Payment Variable → Negative Amortization (WITHOUT debt consolidation)
const scenario3Props: ReportHTMLProps = {
  clientName,
  date,
  consultant,
  bullets: [
    "You have a $415,000 mortgage with Scotiabank that you've held for about 4 years",
    "You chose a variable rate with fixed payments of $1,850/month",
    "You were surprised to learn at your recent statement that your balance has actually increased",
    "Your amortization has extended from 25 years to 26 years despite making every payment",
    "You didn't receive any communication from your bank about the negative amortization",
    "You're concerned about what this means for your financial future",
    "You want to understand what went wrong and how to fix it going forward",
  ],
  mortgageAmount: "$415,000",
  scenario: 3,
  includeDebtConsolidation: false,
  applicationLink,
  extractedData: {
    mortgageAmount: 415000,
    originalAmortization: 25,
    currentAmortization: 26,
    originalRate: 0.0165,
    fixedPayment: 1850,
  },
};

async function generatePDF(props: ReportHTMLProps, filename: string) {
  console.log(`Generating ${filename}...`);

  // Generate HTML
  const html = generateReportHTML(props);

  // Save HTML for browser preview
  const htmlPath = join(OUTPUT_DIR, filename.replace(".pdf", ".html"));
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`  ✓ HTML saved to: ${htmlPath}`);

  // Generate PDF
  const pdfBuffer = await generatePDFFromHTML({
    html,
    printBackground: true,
  });

  const pdfPath = join(OUTPUT_DIR, filename);
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`  ✓ PDF saved to: ${pdfPath}`);

  return { htmlPath, pdfPath };
}

async function main() {
  console.log("\n=== Generating Test PDFs ===\n");
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  try {
    // Generate all scenarios
    const results = await Promise.all([
      generatePDF(scenario1Props, "test-report-scenario-1.pdf"),
      generatePDF(scenario2Props, "test-report-scenario-2.pdf"),
      generatePDF(scenario3Props, "test-report-scenario-3.pdf"),
    ]);

    console.log("\n=== Generation Complete ===\n");
    console.log("Generated files:");
    results.forEach(({ htmlPath, pdfPath }) => {
      console.log(`  HTML: ${htmlPath}`);
      console.log(`  PDF:  ${pdfPath}`);
      console.log("");
    });
    console.log("Open the PDF files to verify the design and content.");
    console.log("Open the HTML files in a browser to preview/debug.\n");
  } catch (error) {
    console.error("Error generating PDFs:", error);
    process.exit(1);
  }
}

main();
