import { config } from "dotenv";
import { handleConversation, executeDecision } from "../lib/holly/conversation-handler";
import { prisma } from "../lib/db";

config();

async function testEmailReply() {
  // Simulate an inbound email reply
  const leadEmail = "zach@inspired.mortgage";
  const replyMessage = "Hey Holly! Thanks for reaching out. I'm definitely interested in learning more about those reserved rates. What's the next step?";

  console.log("🧪 Testing email reply handling...");
  console.log("Email from:", leadEmail);
  console.log("Message:", replyMessage);

  // Find the lead
  const lead = await prisma.lead.findFirst({
    where: { email: leadEmail },
  });

  if (!lead) {
    console.error("❌ Lead not found for email:", leadEmail);
    process.exit(1);
  }

  console.log("✅ Lead found:", lead.id, lead.firstName, lead.lastName);

  // Store the inbound email
  await prisma.communication.create({
    data: {
      leadId: lead.id,
      channel: "EMAIL",
      direction: "INBOUND",
      content: replyMessage,
      metadata: {
        subject: "Re: Your Mortgage Programs",
        from: leadEmail,
        to: "info@inspired.mortgage",
        testMode: true,
      },
    },
  });

  console.log("📧 Inbound email stored in database");

  // Trigger AI to respond (indicate it came from EMAIL)
  console.log("🤖 AI analyzing the reply...");
  const decision = await handleConversation(lead.id, replyMessage, "EMAIL");

  console.log("🎯 AI Decision:", decision.action);
  console.log("💭 Reasoning:", decision.reasoning);

  if (decision.message) {
    console.log("📱 SMS Message:", decision.message);
  }
  if (decision.emailSubject) {
    console.log("📧 Email Subject:", decision.emailSubject);
    console.log("📧 Email Body:", decision.emailBody?.substring(0, 200) + "...");
  }

  // Execute the decision
  console.log("🚀 Executing AI decision...");
  await executeDecision(lead.id, decision);

  console.log("✅ Test complete! Check your email/SMS for the AI response.");
}

testEmailReply().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
