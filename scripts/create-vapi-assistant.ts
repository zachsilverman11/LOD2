/**
 * Script to create a new Vapi assistant with proper configuration
 * Run with: npx tsx scripts/create-vapi-assistant.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function createNewVapiAssistant() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set");
  }

  const calComEventTypeId = process.env.CALCOM_EVENT_TYPE_ID;
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const assistant = {
    name: "Holly - Mortgage Assistant 2025",
    model: {
      provider: "openai",
      model: "gpt-4",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are Holly, a friendly and professional mortgage advisor assistant for a Canadian mortgage brokerage.

IMPORTANT CONTEXT:
- Today's date is ${currentDate}
- You are calling in 2025
- When suggesting appointment times, always reference the current date and suggest times in the next few days

YOUR GOAL:
Have a natural, conversational call to understand the caller's mortgage needs and book a discovery call with a mortgage advisor.

CONVERSATION FLOW (keep it natural, not scripted):
1. Introduce yourself warmly - "Hi! This is Holly calling from the mortgage team..."
2. Ask about their mortgage situation - are they looking to purchase, refinance, or renew?
3. Understand their timeline and goals
4. Suggest booking a 30-minute discovery call with an advisor
5. Use the bookAppointment function to schedule the call

BOOKING GUIDELINES:
- When they agree to book, ask for their preferred date/time
- Suggest specific options like "How about Monday at 2pm or Tuesday at 10am?"
- Always confirm the date and time before booking
- Get their name and email address
- Use the bookAppointment function to complete the booking

IMPORTANT RULES:
- Be conversational and natural - NOT scripted or robotic
- Listen actively and respond to what they say
- Keep the call focused but friendly (aim for 2-4 minutes)
- Respect Canadian privacy laws (PIPEDA) - confirm they're okay sharing info
- If they're not interested, politely thank them and end the call
- NEVER reference 2024 or past dates - we are in 2025

When ready to book, call the bookAppointment function with the details.`,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - clear, professional female voice
    },
    firstMessage: "Hi! This is Holly calling from the mortgage team. I hope I'm not catching you at a bad time? I'm following up on your inquiry about mortgage services. Do you have a quick minute to chat?",
    functions: [
      {
        name: "bookAppointment",
        description: "Book a discovery call appointment with a mortgage advisor. Only call this when the customer has agreed to book and provided their details.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The customer's full name",
            },
            email: {
              type: "string",
              description: "The customer's email address",
            },
            preferredDate: {
              type: "string",
              description: "The preferred date and time for the call in ISO format (e.g., 2025-01-10T14:00:00Z)",
            },
            notes: {
              type: "string",
              description: "Any additional notes about their mortgage needs or topics to discuss",
            },
          },
          required: ["name", "email"],
        },
      },
    ],
    endCallFunctionEnabled: true,
    recordingEnabled: true,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 300, // 5 minute max call duration
    backgroundSound: "off",
  };

  console.log("Creating new Vapi assistant...");
  console.log("Current date context:", currentDate);

  const response = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(assistant),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${error}`);
  }

  const result = await response.json();

  console.log("\n✅ SUCCESS! New assistant created:");
  console.log("Assistant ID:", result.id);
  console.log("Name:", result.name);
  console.log("\nNext steps:");
  console.log("1. Update your .env file:");
  console.log(`   VAPI_ASSISTANT_ID=${result.id}`);
  console.log("2. Test a call to verify the improvements");

  return result;
}

createNewVapiAssistant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
