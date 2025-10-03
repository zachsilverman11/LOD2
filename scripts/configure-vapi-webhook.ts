/**
 * Script to configure Vapi assistant webhook URL
 * Run with: npx tsx scripts/configure-vapi-webhook.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function configureWebhook() {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set");
  }

  if (!assistantId) {
    throw new Error("VAPI_ASSISTANT_ID is not set");
  }

  const webhookUrl = "https://lod2-a9incracj-zach-silvermans-projects.vercel.app/api/webhooks/vapi";

  console.log("Configuring webhook for assistant:", assistantId);
  console.log("Webhook URL:", webhookUrl);

  const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      serverUrl: webhookUrl,
      serverUrlSecret: "vapi-webhook-secret-2025", // Simple secret for now
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${error}`);
  }

  const result = await response.json();

  console.log("\n✅ SUCCESS! Webhook configured:");
  console.log("Server URL:", result.serverUrl);
  console.log("\nNow when Holly calls bookAppointment, it will send a webhook to your server!");
  console.log("\nReady to test? Make another call to verify the booking works.");

  return result;
}

configureWebhook()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
