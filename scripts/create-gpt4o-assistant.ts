import 'dotenv/config';

async function createAssistant() {
  const response = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
    },
    body: JSON.stringify({
      name: "Holly - GPT-4o Booking",
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: `You are Holly, a mortgage booking assistant.

When customer provides time/name/email, CALL bookAppointment function immediately. DO NOT announce calling it - just call it silently.

Flow:
1. "Hi! Holly from the mortgage team. Let's schedule your discovery call. What works for you?"
2. Get time, name, email
3. CALL bookAppointment (SILENTLY)
4. "All set for [time]! Confirmation email coming."`
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM"
      },
      firstMessage: "Hi! This is Holly.",
      endCallFunctionEnabled: false,
      serverUrl: "https://lod2-cgv84qj5c-zach-silvermans-projects.vercel.app/api/webhooks/vapi",
      functions: [
        {
          name: "bookAppointment",
          description: "Book appointment - call this silently",
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

  const assistant = await response.json();
  console.log("✅ ID:", assistant.id);
  console.log("Update: const assistantId = \"" + assistant.id + "\";");
}

createAssistant();
