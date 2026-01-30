/**
 * Generate all test scenario PDFs
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateReportHTML, type ReportHTMLProps } from "../lib/generate-report-html";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";

const OUTPUT_DIR = join(process.cwd(), "test-output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const consultant = {
  name: "Greg Williamson",
  email: "greg@inspired.mortgage",
  phone: "(416) 555-0123",
  calLink: "cal.com/inspired-mortgage/greg",
};

const scenarios: Array<{ name: string; props: ReportHTMLProps }> = [
  {
    name: "scenario-2-variable-panic-lock",
    props: {
      clientName: "Sarah Mitchell",
      date: "January 29, 2026",
      consultant,
      bullets: [
        "You currently have a $520,000 mortgage with Royal Bank that you locked in at 5.79%",
        "You originally started with a variable rate at prime minus 0.85% (around 1.45%)",
        "When rates started climbing in 2022, you panicked and locked into a 5-year fixed",
        "You've been watching rates drop and feel frustrated that you're stuck at the higher rate",
        "Your renewal isn't for another 2.5 years, but you want to understand your options",
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
  {
    name: "scenario-3-negative-am-cashback",
    props: {
      clientName: "Sarah Mitchell",
      date: "January 29, 2026",
      consultant,
      bullets: [
        "You have a $415,000 mortgage with Scotiabank that you've held for about 4 years",
        "You chose a variable rate with fixed payments of $1,850/month",
        "You were surprised to learn at your recent statement that your balance has actually increased",
        "Your amortization has extended from 25 years to 26 years despite making every payment",
        "You want to understand what went wrong and how to fix it going forward",
      ],
      mortgageAmount: "$415,000",
      scenario: 3,
      includeDebtConsolidation: false,
      includeCashBack: true,
      applicationLink: "https://stressfree.mtg-app.com/signup",
      extractedData: {
        mortgageAmount: 415000,
        originalAmortization: 25,
        currentAmortization: 26,
        originalRate: 0.0165,
        fixedPayment: 1850,
      },
    },
  },
  {
    name: "no-scenario-clean",
    props: {
      clientName: "Sarah Mitchell",
      date: "January 29, 2026",
      consultant,
      bullets: [
        "You're looking to purchase your first home in the $600,000 range",
        "You have $120,000 saved for a down payment (20%)",
        "Your combined household income is approximately $150,000",
        "You're not sure whether fixed or variable is right for you",
        "You want to understand all your options before committing",
      ],
      mortgageAmount: "$480,000",
      scenario: null,
      includeDebtConsolidation: false,
      includeCashBack: false,
      applicationLink: "https://stressfree.mtg-app.com/signup",
      extractedData: {
        mortgageAmount: 480000,
      },
    },
  },
];

async function main() {
  for (const s of scenarios) {
    console.log(`Generating ${s.name}...`);
    const html = generateReportHTML(s.props);
    const pdfBuffer = await generatePDFFromHTML({ html, printBackground: true });
    const pdfPath = join(OUTPUT_DIR, `${s.name}.pdf`);
    writeFileSync(pdfPath, pdfBuffer);
    console.log(`  → ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
  }
  console.log("Done!");
}

main().catch(console.error);
