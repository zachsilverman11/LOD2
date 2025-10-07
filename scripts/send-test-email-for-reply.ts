import { config } from "dotenv";
import { sendEmail } from "../lib/email";
import { prisma } from "../lib/db";

config();

/**
 * Send a test email from Holly to Zach
 * Zach will reply to it, and we'll verify the AI responds
 */
async function sendTestEmail() {
  console.log("📧 Sending test email from Holly...\n");

  const emailContent = `
<h2>Hi Zach!</h2>

<p>This is a test of the email reply system. I'm reaching out to see if you're still interested in exploring mortgage options for your Vancouver property purchase.</p>

<p>We have some exclusive programs available:</p>

<ul>
  <li><strong>Guaranteed Approvals Certificate</strong> - Give your offer a competitive edge with a $5K guarantee</li>
  <li><strong>Reserved Ultra-Low Rates</strong> - Pre-negotiated rates locked in for online clients</li>
  <li><strong>Reserved Pre-Approval</strong> - 120-day approval with no employment/income verification</li>
</ul>

<p>Would you like to schedule a quick 15-minute discovery call to discuss your options?</p>

<p><a href="https://cal.com/team/inspired-mortgage/mortgage-discovery-call" class="cta-button">📅 Book Your Discovery Call</a></p>

<p><strong>Please reply to this email</strong> with something like "Yes, I'm interested!" and I'll verify that the AI system receives and responds to your reply.</p>

<p>Thanks!</p>
`;

  try {
    await sendEmail({
      to: "zach@inspired.mortgage",
      subject: "Test: Your Mortgage Programs (Reply to This!)",
      htmlContent: emailContent,
      replyTo: "info@reply.inspired.mortgage",
    });

    console.log("✅ Test email sent to zach@inspired.mortgage");
    console.log("\n📋 Next Steps:");
    console.log("1. Check your inbox for email from info@inspired.mortgage");
    console.log("2. Reply to the email with: 'Yes, I'm interested!'");
    console.log("3. Wait 30-60 seconds");
    console.log("4. Check your SMS/Email for AI response");
    console.log("\nReply-To address: info@reply.inspired.mortgage");
    console.log("(This is where SendGrid will catch the reply)\n");

    // Also log the communication in the database
    const lead = await prisma.lead.findFirst({
      where: { email: "zach@inspired.mortgage" },
    });

    if (lead) {
      await prisma.communication.create({
        data: {
          leadId: lead.id,
          channel: "EMAIL",
          direction: "OUTBOUND",
          content: emailContent,
          metadata: {
            subject: "Test: Your Mortgage Programs (Reply to This!)",
            testMode: true,
          },
        },
      });
      console.log("✅ Communication logged to database for lead:", lead.id);
    }
  } catch (error) {
    console.error("❌ Error sending test email:", error);
  }
}

sendTestEmail();
