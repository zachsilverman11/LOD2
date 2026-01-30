/**
 * Quick PDF generator for the full kitchen-sink report
 * Run: npx tsx scripts/generate-one-pdf.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";

const OUTPUT_DIR = join(process.cwd(), "test-output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const props: ReportHTMLProps = {
  clientName: "Sarah Mitchell",
  date: "January 29, 2026",
  consultant: {
    name: "Greg Williamson",
    email: "greg@inspired.mortgage",
    phone: "(416) 555-0123",
    calLink: "cal.com/inspired-mortgage/greg",
  },
  bullets: [
    "You're coming up for renewal on your $485,000 mortgage with TD Bank",
    "Your current rate of 1.89% has served you well, but you're concerned about payment shock at renewal",
    "You mentioned wanting to keep your monthly payments manageable while not extending your timeline",
    "You have a car loan ($32,000) and line of credit ($18,500) you'd like to potentially consolidate",
    "Your goal is to be mortgage-free before retirement in 15 years",
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

async function main() {
  console.log("Generating full report HTML...");
  const html = generateReportHTML(props);
  
  const htmlPath = join(OUTPUT_DIR, "full-report.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`HTML: ${htmlPath}`);

  console.log("Generating PDF via Puppeteer...");
  const pdfBuffer = await generatePDFFromHTML({ html, printBackground: true });
  
  const pdfPath = join(OUTPUT_DIR, "full-report.pdf");
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(console.error);
