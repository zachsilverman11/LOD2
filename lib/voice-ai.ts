/**
 * Voice AI integration with Vapi.ai
 * Docs: https://docs.vapi.ai
 *
 * Features:
 * - Initiate outbound calls to leads
 * - AI assistant can book appointments via Cal.com during calls
 * - Call transcription and recording
 */

export interface InitiateCallParams {
  phoneNumber: string;
  assistantId?: string;
  metadata?: Record<string, unknown>;
}

export interface CallResult {
  id: string;
  status: string;
  phoneNumber: string;
}

/**
 * Initiate an outbound call to a lead
 */
export async function initiateCall(params: InitiateCallParams): Promise<CallResult> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set");
  }

  const assistantId = params.assistantId || process.env.VAPI_ASSISTANT_ID;
  if (!assistantId) {
    throw new Error("VAPI_ASSISTANT_ID is not set");
  }

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID is not set");
  }

  console.log('DEBUG: assistantId:', assistantId);
  console.log('DEBUG: phoneNumberId:', phoneNumberId);
  console.log('DEBUG: VAPI_ASSISTANT_ID env:', process.env.VAPI_ASSISTANT_ID);
  console.log('DEBUG: VAPI_PHONE_NUMBER_ID env:', process.env.VAPI_PHONE_NUMBER_ID);
  console.log('DEBUG: All VAPI env vars:', Object.keys(process.env).filter(k => k.startsWith('VAPI')));

  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: {
        number: params.phoneNumber,
      },
      metadata: params.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${error}`);
  }

  return response.json();
}

/**
 * Create a Vapi assistant configured for mortgage lead conversion
 * This should be run once during setup
 */
export async function createVapiAssistant() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set");
  }

  const calComEventTypeId = process.env.CALCOM_EVENT_TYPE_ID;

  const assistant = {
    name: "Mortgage Lead Conversion Assistant",
    model: {
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a friendly and professional mortgage advisor assistant for a Canadian mortgage brokerage. Your goal is to:

1. Introduce yourself and the company
2. Understand the caller's mortgage needs (purchase, refinance, renewal)
3. Gather basic information (property type, location, timeline)
4. Schedule a discovery call with a mortgage advisor using the booking tool
5. Answer basic questions about the mortgage process in Canada

Be conversational, empathetic, and helpful. Always respect Canadian privacy laws (PIPEDA) and confirm consent before collecting personal information.

If the lead wants to schedule a call, use the bookAppointment function to book a time slot.`,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: "rachel", // Friendly female voice
    },
    firstMessage: "Hi! Thanks for your interest in our mortgage services. I'm here to help answer any questions and schedule a time for you to speak with one of our expert advisors. How can I help you today?",
    functions: [
      {
        name: "bookAppointment",
        description: "Book a discovery call appointment with a mortgage advisor",
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
              description: "The preferred date and time for the call in ISO format",
            },
            notes: {
              type: "string",
              description: "Any additional notes or topics to discuss",
            },
          },
          required: ["name", "email"],
        },
        // This will trigger a webhook that we handle to actually book via Cal.com
      },
    ],
    endCallFunctionEnabled: true,
    recordingEnabled: true,
    transcriptionEnabled: true,
  };

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

  return response.json();
}

/**
 * Get call details and transcript
 */
export async function getCallDetails(callId: string) {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set");
  }

  const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${error}`);
  }

  return response.json();
}
