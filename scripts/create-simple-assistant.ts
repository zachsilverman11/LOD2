import 'dotenv/config';

async function createAssistant() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY not set");
  }

  const response = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: "Holly - Simple Booking",
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are Holly, a mortgage advisor assistant. Your ONLY job is to book a discovery call.

SCRIPT:
1. Say: "Hi! This is Holly from the mortgage team. I'd love to get a discovery call scheduled for you with one of our advisors. What day and time works best?"

2. Listen to their answer.

3. When they tell you a day/time, IMMEDIATELY call the bookAppointment function with:
   - name: their full name (ask if you don't know it)
   - email: their email address (ask if you don't know it)
   - preferredDate: convert their answer to ISO format like "2025-10-07T14:00:00-07:00"
   - notes: "Discovery call"

4. After calling the function, say: "Perfect! You're all set. You'll get a confirmation email shortly."

CRITICAL RULES:
- Call bookAppointment as soon as they give you a time
- Be brief and efficient
- If they say "anytime tomorrow", pick a specific time like 2pm tomorrow and confirm with them first`
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM"
      },
      firstMessage: "Hi! This is Holly from the mortgage team.",
      endCallFunctionEnabled: false,
      serverUrl: "https://lod2-2cbx6qcsb-zach-silvermans-projects.vercel.app/api/webhooks/vapi",
      functions: [
        {
          name: "bookAppointment",
          description: "Book a discovery call",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              preferredDate: { type: "string" },
              notes: { type: "string" }
            },
            required: ["name", "email"]
          }
        }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed: ${error}`);
  }

  const assistant = await response.json();
  console.log("\n✅ Created:", assistant.id);
  console.log("Update lib/voice-ai.ts:");
  console.log(`const assistantId = "${assistant.id}";`);

  return assistant;
}

createAssistant().catch(console.error);
