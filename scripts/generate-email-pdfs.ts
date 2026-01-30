/**
 * Generate email template PDFs for review
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generatePDFFromHTML } from "../lib/generate-report-puppeteer";
import {
  buildReportDeliveryEmail,
  buildDay3FollowUpEmail,
  buildDay7FollowUpEmail,
} from "../lib/email-templates/post-call-sequence";

const OUTPUT_DIR = join(process.cwd(), "test-output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const params = {
  clientFirstName: "Sarah",
  advisorName: "Greg Williamson",
  advisorEmail: "greg@inspired.mortgage",
  advisorPhone: "(416) 555-0123",
};

async function main() {
  const emails = [
    { name: "email-1-report-delivery", ...buildReportDeliveryEmail(params) },
    { name: "email-2-day3-followup", ...buildDay3FollowUpEmail(params) },
    { name: "email-3-day7-followup", ...buildDay7FollowUpEmail(params) },
  ];

  for (const email of emails) {
    console.log(`Generating ${email.name} — "${email.subject}"...`);
    const pdfBuffer = await generatePDFFromHTML({
      html: email.html,
      printBackground: true,
      format: "letter",
    });
    const pdfPath = join(OUTPUT_DIR, `${email.name}.pdf`);
    writeFileSync(pdfPath, pdfBuffer);
    console.log(`  → ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
  }
  console.log("Done!");
}

main().catch(console.error);
