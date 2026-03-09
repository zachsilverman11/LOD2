/**
 * Preview script for cover page design
 * Run with: npx tsx scripts/preview-cover-page.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML } from "../lib/generate-report-html";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";

const OUTPUT_DIR = join(process.cwd(), "test-pdfs");

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Sample data
const sampleProps = {
  clientName: "Sarah Mitchell",
  date: "January 16, 2026",
  consultant: {
    name: "Greg Williamson",
    email: "greg@inspired.mortgage",
    phone: "(416) 555-0123",
    calLink: "cal.com/inspired-mortgage/greg",
  },
  bullets: [
    "You're coming up for renewal on your $485,000 mortgage with TD Bank",
    "Your current rate of 1.89% has served you well, but you're concerned about payment shock at renewal",
  ],
  mortgageAmount: "$485,000",
  scenario: 1 as 1 | 2 | 3 | null,
  includeDebtConsolidation: false,
  includeCashBack: false,
  applicationLink: "https://www.inspired.mortgage/start-here",
  extractedData: {
    mortgageAmount: 485000,
    currentAmortization: 20,
    previousRate: 0.0189,
    currentMarketRate: 0.0449,
    oldPayment: 2045,
    newPayment: 2689,
    paymentDifference: 644,
    fiveYearsOfPayments: 161340,
  },
};

async function main() {
  console.log("\n=== Generating Cover Page Preview ===\n");

  // Generate HTML
  const html = generateReportHTML(sampleProps);

  // Save HTML for browser preview
  const htmlPath = join(OUTPUT_DIR, "cover-page-preview.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`HTML saved to: ${htmlPath}`);

  // Generate PDF
  console.log("\nGenerating PDF...");
  const pdfBuffer = await generatePDFFromHTML({ html });
  const pdfPath = join(OUTPUT_DIR, "cover-page-preview.pdf");
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`PDF saved to: ${pdfPath}`);

  console.log("\n=== Preview Complete ===");
  console.log("\nOpen these files to review the cover page design:");
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  PDF:  ${pdfPath}`);
}

main().catch(console.error);
