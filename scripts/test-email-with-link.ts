import { config } from "dotenv";
import { sendEmail } from "../lib/email";

config();

// Manually create an email with the booking link to test formatting
const testEmailWithLink = `
<h2>Hi Zach!</h2>

<p>Thanks for your interest in our Reserved Ultra-Low Rates and Guaranteed Approvals Certificate!</p>

<p>The next step is simple - let's get you on a quick 15-minute discovery call with one of our mortgage advisors (Greg Williamson or Jakub Huncik). They'll:</p>

<ul>
  <li><strong>Review your specific situation</strong> - $750K purchase in Vancouver</li>
  <li><strong>Confirm qualification</strong> for our exclusive reserved rates</li>
  <li><strong>Explain the Guaranteed Approvals Certificate</strong> and how it gives you a competitive edge</li>
  <li><strong>Answer all your questions</strong> about programs, rates, and next steps</li>
</ul>

<p>Ready to book your call? Click the button below to choose a time that works for you:</p>

<p><a href="https://cal.com/team/inpired-mortgage/mortgage-discovery-call" class="cta-button">📅 Book Your Discovery Call</a></p>

<p>The call is quick, no pressure, and you'll walk away knowing exactly what you qualify for and what your options are.</p>

<p>Looking forward to helping you secure those rates!</p>

<p>Best,<br>Holly</p>
`;

async function main() {
  console.log("📧 Sending test email with clickable Cal.com link...");

  await sendEmail({
    to: "zach@inspired.mortgage",
    subject: "Ready to book your call? Here's your link!",
    htmlContent: testEmailWithLink,
  });

  console.log("✅ Test email sent to zach@inspired.mortgage");
  console.log("\nCheck your inbox! The email should have:");
  console.log("- Purple gradient Inspired Mortgage header");
  console.log("- Clickable 'Book Your Discovery Call' button (purple, styled)");
  console.log("- Cal.com link: https://cal.com/team/inpired-mortgage/mortgage-discovery-call");
  console.log("- Holly signature with info@inspired.mortgage");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
