/**
 * SMS sending via Twilio
 * Docs: https://www.twilio.com/docs/sms
 */

export interface SendSmsParams {
  to: string;
  body: string;
  from?: string;
}

export async function sendSms(params: SendSmsParams) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = params.from || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("To", params.to);
  formData.append("From", fromNumber);
  formData.append("Body", params.body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Parse Twilio error to check for specific error codes
    try {
      const errorJson = JSON.parse(errorText);

      // Error 21610: Attempt to send to unsubscribed recipient
      // This means the lead opted out via STOP message or carrier block
      if (errorJson.code === 21610) {
        const error = new Error(`Twilio API error: ${errorText}`) as any;
        error.isTwilioOptOut = true;
        error.twilioErrorCode = 21610;
        throw error;
      }
    } catch (parseError) {
      // If JSON parsing fails, continue with original error
    }

    throw new Error(`Twilio API error: ${errorText}`);
  }

  return response.json();
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode: string = "+1"): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Add country code if not present
  if (!phone.startsWith("+")) {
    // If it's a 10-digit number (North American), add +1
    if (cleaned.length === 10) {
      cleaned = defaultCountryCode.replace("+", "") + cleaned;
    }
  }

  return "+" + cleaned;
}

/**
 * Default SMS templates
 */
export const SMS_TEMPLATES = {
  WELCOME: "Hi {{firstName}}! Thanks for your interest in our mortgage services. We'll be in touch soon to schedule a discovery call. Reply STOP to opt out.",

  SCHEDULE_CALL: "Hi {{firstName}}, it's {{advisorName}} from the mortgage team. Ready to discuss your mortgage options? Book a call here: {{schedulingLink}}",

  CALL_REMINDER: "Reminder: Your discovery call with {{advisorName}} is tomorrow at {{callTime}}. Join here: {{meetingLink}}",

  FOLLOW_UP: "Hi {{firstName}}, following up on our call. Next steps: {{nextSteps}}. Let me know if you have any questions!",

  CHECK_IN: "Hi {{firstName}}, just checking in! Have you had a chance to review the information I sent? Happy to answer any questions.",
};
