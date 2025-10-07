import { config } from "dotenv";

config();

/**
 * Test the inbound email webhook by simulating what SendGrid Inbound Parse sends
 * This tests if the webhook properly receives email replies and triggers AI responses
 */
async function testInboundEmailWebhook() {
  console.log("🧪 Testing inbound email webhook...\n");

  // Simulate SendGrid Inbound Parse POST data
  const formData = new FormData();
  formData.append("from", "Zach Silverman <zach@inspired.mortgage>");
  formData.append("to", "info@inspired.mortgage");
  formData.append("subject", "Re: Your Mortgage Programs");
  formData.append("text", "Yes, I'm very interested! Can you send me the booking link to schedule a call?");
  formData.append("html", "<p>Yes, I'm very interested! Can you send me the booking link to schedule a call?</p>");

  try {
    console.log("📤 Sending test email reply to webhook...");
    console.log("From: zach@inspired.mortgage");
    console.log("Subject: Re: Your Mortgage Programs");
    console.log("Message: Yes, I'm very interested! Can you send me the booking link to schedule a call?\n");

    const response = await fetch("https://lod2.vercel.app/api/webhooks/inbound-email", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Webhook received the email successfully!");
      console.log("📊 Response:", JSON.stringify(result, null, 2));
      console.log("\n🤖 AI should have:");
      console.log("   1. Logged the inbound email to database");
      console.log("   2. Analyzed the message");
      console.log("   3. Decided whether to respond via SMS, Email, or Both");
      console.log("   4. Sent the response automatically");
      console.log("\n📧 Check your email/SMS to see the AI's response!");
    } else {
      console.error("❌ Webhook failed!");
      console.error("Status:", response.status);
      console.error("Response:", result);
    }
  } catch (error) {
    console.error("❌ Error testing webhook:", error);
  }
}

testInboundEmailWebhook();
