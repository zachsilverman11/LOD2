/**
 * Generate Round 3 review PDF for Greg — all fixes visible
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";
import { getAdvisorPhone } from "../lib/report-copy";

const OUTPUT_DIR = join(process.cwd(), "test-output/greg-round3");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// Use getAdvisorPhone to get the correct fallback number
const consultant = {
  name: "Greg Williamson",
  email: "greg@inspired.mortgage",
  phone: getAdvisorPhone("Greg Williamson"), // 403-560-2354 from fallback
  calLink: "cal.com/inspired-mortgage/greg",
};

const props: ReportHTMLProps = {
  clientName: "Sarah Mitchell",
  date: "January 31, 2026",
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
};

async function main() {
  console.log("Generating Round 3 review PDF for Greg...");
  console.log(`  Advisor: ${consultant.name}`);
  console.log(`  Phone: ${consultant.phone}`);
  
  const html = generateReportHTML(props);
  
  // Save HTML for inspection
  const htmlPath = join(OUTPUT_DIR, "Round3-Scenario1-Full.html");
  writeFileSync(htmlPath, html);
  console.log(`  HTML → ${htmlPath}`);
  
  // Generate PDF
  const pdfBuffer = await generatePDFFromHTML({ html, printBackground: true });
  const pdfPath = join(OUTPUT_DIR, "Round3-Scenario1-Full.pdf");
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`  PDF → ${pdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);
  
  console.log("\nDone! Verify:");
  console.log("  1. Cover page: 'Co-Founder' title, phone 403-560-2354");
  console.log("  2. Debt table: 'Home renovation loan' NOT bolded");
  console.log("  3. Signature: 'Co-Founder, Inspired Mortgage'");
  console.log("  4. What Happens Next: 'Co-Founder' title, phone shown");
}

main().catch(console.error);
