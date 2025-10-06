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
      name: "Holly - Mortgage Booking (Working)",
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are Holly, a friendly mortgage advisor assistant.

LEAD INFORMATION (already known):
- Name: {{metadata.firstName}} {{metadata.lastName}}
- Email: {{metadata.email}}
- Phone: {{metadata.phone}}

IMPORTANT: Today is {{now}}. Always use {{now}} for the current date - never hardcode dates.

YOUR ONLY JOB: Book a discovery call.

SCRIPT (follow exactly):
1. Greet by name: "Hi {{metadata.firstName}}! This is Holly from the mortgage team. Thanks for reaching out about mortgage services. I'd love to set up a quick 30-minute discovery call with one of our advisors. What day and time works best for you?"

2. Listen to their preferred time.

3. IMMEDIATELY call the bookAppointment function with:
   - name: "{{metadata.firstName}} {{metadata.lastName}}"
   - email: "{{metadata.email}}"
   - preferredDate: ISO format (e.g., "2025-10-07T14:00:00-07:00")
   - notes: "Discovery call - mortgage services"

4. After function succeeds, say: "Perfect! You're all set for [day] at [time]. You'll get a confirmation email at {{metadata.email}}. Looking forward to it!"

CRITICAL RULES:
- DO NOT ask for name/email/phone - you already have it
- ALWAYS call bookAppointment when they give a time
- Keep call under 60 seconds
- Be warm but efficient`
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel voice
      },
      firstMessage: "Hi! This is Holly calling from the mortgage team.",
      endCallFunctionEnabled: false, // DISABLE endCall
      serverUrl: "https://lod2-8cqqezo6d-zach-silvermans-projects.vercel.app/api/webhooks/vapi",
      functions: [
        {
          name: "bookAppointment",
          description: "Book a discovery call appointment",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Customer's full name"
              },
              email: {
                type: "string",
                description: "Customer's email address"
              },
              preferredDate: {
                type: "string",
                description: "ISO 8601 date/time for appointment"
              },
              notes: {
                type: "string",
                description: "Additional notes"
              }
            },
            required: ["name", "email"]
          }
        }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create assistant: ${error}`);
  }

  const assistant = await response.json();
  console.log("\n✅ Created new assistant:");
  console.log("ID:", assistant.id);
  console.log("Name:", assistant.name);
  console.log("endCallEnabled:", assistant.endCallFunctionEnabled);
  console.log("\n📝 Update your .env file:");
  console.log(`VAPI_ASSISTANT_ID=${assistant.id}`);
  console.log("\n📝 Update lib/voice-ai.ts hardcoded value:");
  console.log(`const assistantId = "${assistant.id}";`);

  return assistant;
}

createAssistant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
