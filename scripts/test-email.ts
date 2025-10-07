import { config } from "dotenv";
import { sendEmail } from "../lib/email";

// Load environment variables
config();

const testEmailContent = `
<h2>Hey Zach! 👋</h2>

<p>This is a test of the new AI-driven multi-channel email system for Inspired Mortgage.</p>

<p>Here's what we just built:</p>

<ul>
  <li><strong>Smart Channel Selection</strong> - AI decides whether to use SMS, Email, or Both based on context</li>
  <li><strong>Branded Templates</strong> - Every email automatically gets the Inspired Mortgage look and feel</li>
  <li><strong>Multi-Channel Coordination</strong> - SMS alerts + Email details work together like a 1-2 punch</li>
  <li><strong>Fully AI-Driven</strong> - No static templates, the AI writes personalized content for each lead</li>
</ul>

<p>The system is ready to convert leads into booked appointments with your high-converting AI strategy.</p>

<p><a href="https://cal.com/inspired-mortgage" class="cta-button">📅 See How It Works</a></p>

<p>Ready to test with real leads whenever you are!</p>

<p><strong>Your AI assistant</strong></p>
`;

async function main() {
  try {
    await sendEmail({
      to: "zach@inspired.mortgage",
      subject: "✨ Your Multi-Channel AI System is Live!",
      htmlContent: testEmailContent,
    });
    console.log("✅ Test email sent successfully to zach@inspired.mortgage");
  } catch (error) {
    console.error("❌ Error sending test email:", error);
    process.exit(1);
  }
}

main();
